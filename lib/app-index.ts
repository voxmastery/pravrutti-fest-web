import type { Application } from "@/lib/applications";
import { phoneDigits } from "@/lib/checkin";
import { sqlEnabled, sqlExecute, sqlQuery, sqlReadJson } from "@/lib/sql-store";

/**
 * Secondary index for scanner lookups.
 *
 * The kv table is one JSON document per path. Listing `app/` and reading
 * every row — what the gate used to do — is one query per registration.
 * This table is derived from those documents so an email, phone, or ticket
 * id is a point lookup. Reads never create or fill it: a missing index
 * falls back to a single JSON scan, which is still one round trip.
 */
export const APP_INDEX_READY = "meta/app-index-ready.json";

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS app_index (
  path VARCHAR(191) NOT NULL PRIMARY KEY,
  event_id VARCHAR(80) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(32) NOT NULL DEFAULT '',
  ticket_id VARCHAR(64) NOT NULL DEFAULT '',
  name_lc VARCHAR(191) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL,
  checked_in TINYINT(1) NOT NULL DEFAULT 0,
  KEY app_index_email (email),
  KEY app_index_phone (phone),
  KEY app_index_ticket (ticket_id),
  KEY app_index_name (name_lc),
  KEY app_index_event (event_id, status, checked_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensuring: Promise<void> | null = null;

export function ensureAppIndex(): Promise<void> {
  if (!ensuring) {
    ensuring = sqlQuery(CREATE_SQL).then(
      () => undefined,
      (err) => {
        ensuring = null;
        throw err;
      }
    );
  }
  return ensuring;
}

function indexRow(path: string, data: unknown) {
  if (!path.startsWith("app/") || !data || typeof data !== "object") return null;
  const a = data as Application;
  if (!a.email || !a.eventId) return null;
  return {
    path,
    eventId: String(a.eventId),
    email: String(a.email).toLowerCase(),
    phone: phoneDigits(a.phone).slice(-10),
    ticketId: String(a.ticketId ?? ""),
    name: String(a.name ?? "").toLowerCase().slice(0, 191),
    status: String(a.status ?? ""),
    checkedIn: a.checkedInAt ? 1 : 0,
  };
}

const UPSERT = `INSERT INTO app_index
  (path, event_id, email, phone, ticket_id, name_lc, status, checked_in)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    event_id = VALUES(event_id),
    email = VALUES(email),
    phone = VALUES(phone),
    ticket_id = VALUES(ticket_id),
    name_lc = VALUES(name_lc),
    status = VALUES(status),
    checked_in = VALUES(checked_in)`;

/** Keeps the index aligned with a kv write. Failures must not fail the write. */
export async function syncAppIndex(path: string, data: unknown): Promise<void> {
  if (!sqlEnabled() || !path.startsWith("app/")) return;
  const row = indexRow(path, data);
  if (!row) return;
  await ensureAppIndex();
  await sqlExecute(UPSERT, [
    row.path, row.eventId, row.email, row.phone, row.ticketId, row.name, row.status, row.checkedIn,
  ]);
}

export async function removeAppIndex(path: string): Promise<void> {
  if (!sqlEnabled() || !path.startsWith("app/")) return;
  try {
    await sqlExecute(`DELETE FROM app_index WHERE path = ?`, [path]);
  } catch {
    /* The table may not exist yet. The kv delete already happened. */
  }
}

let trustedUntil = 0;
let trusted = false;

/** True only after the backfill has marked the index complete. */
export async function appIndexTrusted(): Promise<boolean> {
  if (!sqlEnabled()) return false;
  if (Date.now() < trustedUntil) return trusted;
  try {
    trusted = Boolean(await sqlReadJson(APP_INDEX_READY));
  } catch {
    trusted = false;
  }
  trustedUntil = Date.now() + 60_000;
  return trusted;
}

function parseApps(rows: { data: string }[]): Application[] {
  const out: Application[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.data) as Application;
      if (parsed?.email && parsed?.eventId) out.push(parsed);
    } catch {
      /* A corrupt document is skipped, not fatal to the scan. */
    }
  }
  return out;
}

async function appsFromPaths(paths: string[]): Promise<Application[]> {
  const out: Application[] = [];
  for (const path of paths) {
    const row = (await sqlReadJson(path)) as Application | null;
    if (row?.email && row?.eventId) out.push(row);
  }
  return out;
}

export async function sqlAppsByEmail(email: string): Promise<Application[] | null> {
  if (!sqlEnabled()) return null;
  const who = email.toLowerCase();
  if (await appIndexTrusted()) {
    try {
      const [rows] = await sqlExecute(
        `SELECT path FROM app_index WHERE email = ?`,
        [who]
      );
      return appsFromPaths((rows as { path: string }[]).map((r) => r.path));
    } catch {
      /* Fall through to the single JSON scan. */
    }
  }
  try {
    const [rows] = await sqlExecute(
      `SELECT data FROM kv
       WHERE path LIKE 'app/%'
         AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) = ?`,
      [who]
    );
    return parseApps(rows as { data: string }[]);
  } catch {
    return null;
  }
}

export async function sqlAppsByTicket(ticketId: string): Promise<Application[] | null> {
  if (!sqlEnabled()) return null;
  const id = ticketId.trim();
  if (await appIndexTrusted()) {
    try {
      const [rows] = await sqlExecute(
        `SELECT path FROM app_index WHERE ticket_id = ?`,
        [id]
      );
      return appsFromPaths((rows as { path: string }[]).map((r) => r.path));
    } catch {
      /* Fall through. */
    }
  }
  try {
    const [rows] = await sqlExecute(
      `SELECT data FROM kv
       WHERE path LIKE 'app/%'
         AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.ticketId')) = ?
       LIMIT 5`,
      [id]
    );
    return parseApps(rows as { data: string }[]);
  } catch {
    return null;
  }
}

export type SearchHit = Application;

/**
 * One query for the desk's manual lookup. The index is used once the
 * backfill has finished; until then the same predicate runs against kv.
 */
export async function sqlSearchApps(args: {
  email?: string;
  phone?: string;
  ticketId?: string;
  namePrefix?: string;
  limit: number;
}): Promise<Application[] | null> {
  if (!sqlEnabled()) return null;
  const limit = Math.min(Math.max(args.limit, 1), 20);
  if (await appIndexTrusted()) {
    try {
      const where: string[] = [];
      const params: unknown[] = [];
      if (args.email) {
        where.push("email = ?");
        params.push(args.email.toLowerCase());
      }
      if (args.phone) {
        where.push("phone = ?");
        params.push(args.phone);
      }
      if (args.ticketId) {
        where.push("ticket_id = ?");
        params.push(args.ticketId);
      }
      if (args.namePrefix) {
        where.push("name_lc LIKE ? ESCAPE '\\\\'");
        params.push(`${args.namePrefix.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      }
      if (!where.length) return [];
      const [rows] = await sqlExecute(
        `SELECT path FROM app_index WHERE ${where.join(" OR ")} LIMIT ${limit}`,
        params
      );
      return appsFromPaths((rows as { path: string }[]).map((r) => r.path));
    } catch {
      /* Fall through. */
    }
  }
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    if (args.email) {
      where.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) = ?");
      params.push(args.email.toLowerCase());
    }
    if (args.phone) {
      where.push("JSON_UNQUOTE(JSON_EXTRACT(data, '$.phone')) = ?");
      params.push(args.phone);
    }
    if (args.ticketId) {
      where.push("JSON_UNQUOTE(JSON_EXTRACT(data, '$.ticketId')) = ?");
      params.push(args.ticketId);
    }
    if (args.namePrefix) {
      where.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))) LIKE ? ESCAPE '\\\\'");
      params.push(`${args.namePrefix.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
    if (!where.length) return [];
    const [rows] = await sqlExecute(
      `SELECT data FROM kv WHERE path LIKE 'app/%' AND (${where.join(" OR ")}) LIMIT ${limit}`,
      params
    );
    return parseApps(rows as { data: string }[]);
  } catch {
    return null;
  }
}

export type CountRow = { eventId: string; confirmed: number; checkedIn: number };

export async function sqlCheckinCounts(): Promise<{ gate: number; events: CountRow[] } | null> {
  if (!sqlEnabled()) return null;
  try {
    if (await appIndexTrusted()) {
      const [rows] = await sqlExecute(
        `SELECT event_id,
                SUM(status = 'confirmed') AS confirmed,
                SUM(status = 'confirmed' AND checked_in = 1) AS checked_in
         FROM app_index
         GROUP BY event_id`
      );
      const gate = await sqlGateCount();
      return {
        gate,
        events: (rows as { event_id: string; confirmed: number; checked_in: number }[]).map((r) => ({
          eventId: r.event_id,
          confirmed: Number(r.confirmed) || 0,
          checkedIn: Number(r.checked_in) || 0,
        })),
      };
    }
    const [rows] = await sqlExecute(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.eventId')) AS event_id,
              SUM(JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) = 'confirmed') AS confirmed,
              SUM(
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) = 'confirmed'
                AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.checkedInAt')) IS NOT NULL
                AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.checkedInAt')) <> 'null'
              ) AS checked_in
       FROM kv
       WHERE path LIKE 'app/%'
       GROUP BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.eventId'))`
    );
    const gate = await sqlGateCount();
    return {
      gate,
      events: (rows as { event_id: string; confirmed: number; checked_in: number }[])
        .filter((r) => r.event_id)
        .map((r) => ({
          eventId: r.event_id,
          confirmed: Number(r.confirmed) || 0,
          checkedIn: Number(r.checked_in) || 0,
        })),
    };
  } catch {
    return null;
  }
}

async function sqlGateCount(): Promise<number> {
  const [rows] = await sqlExecute(
    `SELECT COUNT(*) AS n FROM kv
     WHERE path LIKE 'gate/%'
       AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.enteredAt')) IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.enteredAt')) <> 'null'`
  );
  return Number((rows as { n: number }[])[0]?.n) || 0;
}
