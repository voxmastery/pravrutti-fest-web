import "server-only";
import { putJson, readJsonByPath } from "@/lib/blob-store";
import { DISCOVERIZE_EVENT_ID } from "@/lib/discoverize";
import { sqlEnabled, sqlExecute, sqlQuery } from "@/lib/sql-store";

/**
 * Who the Discoverize coordinators have shortlisted, as a row in MySQL.
 *
 * The application documents stay the record of a registration. This table is
 * only the decision — one row per lead email — so a coordinator can change
 * it from the screening desk without a deploy. It is additive: created with
 * IF NOT EXISTS, never altered, and an explicit `shortlisted = 0` is how a
 * removal is remembered. The hardcoded list in lib/discoverize-shortlist.ts
 * still names the first set; a missing row means "fall back to that list",
 * so those teams stay shortlisted even before this table is seeded.
 *
 * The `kv` table was created once by scripts/migrate-blob-to-mysql.mjs, before
 * the app ever ran. This one has to appear on the database that is already
 * live, so it is created the first time it is touched and again at startup.
 * Both are the same CREATE TABLE IF NOT EXISTS.
 *
 * Where MySQL is not configured (tests, the local filesystem store, the
 * Vercel test site) the same row is kept under a `discoverize-shortlist/`
 * key in the ordinary store, so the decision is still persistent there and
 * the tests can see it. Production on Hostinger has MySQL, and uses the table.
 */

export const DISCOVERIZE_SHORTLIST_TABLE = "discoverize_shortlist";

/** Additive only. No DROP, no ALTER of anything that already exists. */
export const DISCOVERIZE_SHORTLIST_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS \`${DISCOVERIZE_SHORTLIST_TABLE}\` (
     lead_email VARCHAR(191) NOT NULL,
     event_id VARCHAR(80) NOT NULL,
     shortlisted TINYINT(1) NOT NULL,
     toggled_by VARCHAR(191) NULL,
     toggled_at VARCHAR(40) NULL,
     PRIMARY KEY (event_id, lead_email)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export type ShortlistFlag = {
  shortlisted: boolean;
  /** Who last toggled it — a coordinator or an organiser, by email. */
  by: string | null;
  /** When they toggled it, ISO-8601. */
  at: string | null;
};

const norm = (email: string | null | undefined) => String(email ?? "").trim().toLowerCase();

/** Fallback key, used only when MySQL is not the backend. */
export function shortlistFlagPath(email: string) {
  return `discoverize-shortlist/${DISCOVERIZE_EVENT_ID}/${norm(email)}.json`;
}

let ensuring: Promise<void> | null = null;

export function ensureDiscoverizeShortlistTable(): Promise<void> {
  if (!sqlEnabled()) return Promise.resolve();
  if (!ensuring) {
    ensuring = sqlQuery(DISCOVERIZE_SHORTLIST_TABLE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensuring = null;
        throw err;
      });
  }
  return ensuring;
}

/* One read of the whole table serves every row on the desk. Short enough
   that the other Node process Hostinger runs picks up a toggle quickly,
   and cleared on every write in this process. */
const CACHE_MS = 1500;
let sqlCache: { at: number; map: Map<string, ShortlistFlag> } | null = null;

function remember(map: Map<string, ShortlistFlag>) {
  sqlCache = { at: Date.now(), map };
  return map;
}

export function invalidateShortlistFlagCache() {
  sqlCache = null;
}

async function flagsFromSql(): Promise<Map<string, ShortlistFlag>> {
  if (sqlCache && Date.now() - sqlCache.at < CACHE_MS) return sqlCache.map;
  await ensureDiscoverizeShortlistTable();
  const [rows] = await sqlExecute(
    `SELECT lead_email, shortlisted, toggled_by, toggled_at
       FROM \`${DISCOVERIZE_SHORTLIST_TABLE}\` WHERE event_id = ?`,
    [DISCOVERIZE_EVENT_ID],
  );
  const map = new Map<string, ShortlistFlag>();
  for (const r of rows as {
    lead_email: string; shortlisted: number | boolean; toggled_by: string | null; toggled_at: string | null;
  }[]) {
    map.set(norm(r.lead_email), {
      shortlisted: Number(r.shortlisted) === 1 || r.shortlisted === true,
      by: r.toggled_by ?? null,
      at: r.toggled_at ?? null,
    });
  }
  return remember(map);
}

/**
 * The stored decision for one lead, or null when nobody has toggled them.
 *
 * Null is not "no": the caller still has the hardcoded list. A row with
 * `shortlisted: false` is an explicit removal and wins over that list.
 * A read that fails — table not there yet, database blip — is null too,
 * so the list keeps the teams it already names and the page still loads.
 */
export async function readShortlistFlag(email: string | null | undefined): Promise<ShortlistFlag | null> {
  const key = norm(email);
  if (!key) return null;
  if (sqlEnabled()) {
    try {
      return (await flagsFromSql()).get(key) ?? null;
    } catch (e) {
      console.error("[discoverize-shortlist] flag read failed", e);
      return null;
    }
  }
  try {
    const row = (await readJsonByPath(shortlistFlagPath(key))) as
      | { eventId?: string; shortlisted?: boolean; by?: string | null; at?: string | null }
      | null;
    if (!row || row.eventId !== DISCOVERIZE_EVENT_ID) return null;
    return { shortlisted: Boolean(row.shortlisted), by: row.by ?? null, at: row.at ?? null };
  } catch {
    return null;
  }
}

/**
 * Records a toggle. The latest one wins, and it is the audit: who, and when.
 * Throws when the write itself fails — a coordinator should see that it did
 * not stick, rather than a desk that says it did.
 */
export async function putShortlistFlag(
  email: string,
  shortlisted: boolean,
  by: string,
  at: string,
): Promise<void> {
  const key = norm(email);
  if (!key) throw new Error("Missing lead email.");
  if (sqlEnabled()) {
    await ensureDiscoverizeShortlistTable();
    await sqlExecute(
      `INSERT INTO \`${DISCOVERIZE_SHORTLIST_TABLE}\`
         (lead_email, event_id, shortlisted, toggled_by, toggled_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shortlisted = VALUES(shortlisted),
         toggled_by = VALUES(toggled_by),
         toggled_at = VALUES(toggled_at)`,
      [key, DISCOVERIZE_EVENT_ID, shortlisted ? 1 : 0, by, at],
    );
    invalidateShortlistFlagCache();
    return;
  }
  await putJson(
    shortlistFlagPath(key),
    { leadEmail: key, eventId: DISCOVERIZE_EVENT_ID, shortlisted, by, at },
    true,
  );
}

/**
 * Puts the first set into the table without touching a row that is already
 * there. INSERT IGNORE, so a lead a coordinator has since taken off stays
 * off, and running this on every boot changes nothing the second time.
 */
export async function seedListedLeads(emails: readonly string[], by: string, at: string): Promise<void> {
  if (sqlEnabled()) {
    await ensureDiscoverizeShortlistTable();
    for (const email of emails) {
      const key = norm(email);
      if (!key) continue;
      await sqlExecute(
        `INSERT IGNORE INTO \`${DISCOVERIZE_SHORTLIST_TABLE}\`
           (lead_email, event_id, shortlisted, toggled_by, toggled_at)
         VALUES (?, ?, 1, ?, ?)`,
        [key, DISCOVERIZE_EVENT_ID, by, at],
      );
    }
    invalidateShortlistFlagCache();
    return;
  }
  for (const email of emails) {
    const key = norm(email);
    if (!key) continue;
    if (await readJsonByPath(shortlistFlagPath(key))) continue;
    try {
      await putJson(
        shortlistFlagPath(key),
        { leadEmail: key, eventId: DISCOVERIZE_EVENT_ID, shortlisted: true, by, at },
        false,
      );
    } catch {
      /* Claimed between the read and the write — leave it. */
    }
  }
}
