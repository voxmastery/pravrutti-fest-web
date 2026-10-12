/**
 * Read-only ticket validity check.
 *
 * Generates each confirmed registration's QR payload the way My Tickets does,
 * parses it back, and checks the stored key. It never writes: a MySQL session
 * is set read-only before the select, and this file has no INSERT, UPDATE,
 * or DELETE.
 *
 *   node --experimental-strip-types scripts/qr-validity-check.mts
 *   node --experimental-strip-types scripts/qr-validity-check.mts --dump /tmp/apps.json
 */
import { writeFileSync } from "fs";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import { applicationKey, classifyStoredTicket, parseTicketPayload, type DryRunReason } from "../lib/checkin.ts";
import { ticketPayload } from "../lib/ticket-qr.ts";

type Row = {
  path: string | null;
  ticketId?: string | null;
  eventId?: string | null;
  email?: string | null;
  status?: string | null;
  name?: string | null;
};

const dumpArg = process.argv.indexOf("--dump");
const dumpPath = dumpArg >= 0 ? process.argv[dumpArg + 1] : "";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function loadDump(file: string): Promise<Row[]> {
  const raw = JSON.parse(await (await import("fs/promises")).readFile(file, "utf8"));
  if (Array.isArray(raw)) {
    return raw.map((row) => {
      const app = row.data ?? row;
      return {
        path: typeof row.path === "string" ? row.path : null,
        ticketId: app.ticketId,
        eventId: app.eventId,
        email: app.email,
        status: app.status,
        name: app.name,
      };
    });
  }
  if (raw?.cols && raw?.rows) {
    const cols: string[] = raw.cols;
    return raw.rows.map((cells: unknown[]) => {
      const rec: Record<string, unknown> = {};
      cols.forEach((col, i) => {
        rec[col] = cells[i];
      });
      return {
        path: null,
        ticketId: rec.ticketId as string,
        eventId: rec.eventId as string,
        email: rec.email as string,
        status: rec.status as string,
        name: rec.name as string,
      };
    });
  }
  throw new Error("Unrecognised dump. Expected {path,data} rows or a {cols,rows} export.");
}

async function loadMysql(): Promise<Row[]> {
  const mysql = (await import("mysql2/promise")).default;
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  });
  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    const [rows] = await conn.query(
      "SELECT path, data FROM kv WHERE path LIKE 'app/%'"
    );
    return (rows as { path: string; data: string }[]).map((row) => {
      let app: Record<string, unknown> = {};
      try {
        app = JSON.parse(row.data);
      } catch {
        app = {};
      }
      return {
        path: row.path,
        ticketId: app.ticketId as string,
        eventId: app.eventId as string,
        email: app.email as string,
        status: app.status as string,
        name: app.name as string,
      };
    });
  } finally {
    await conn.end();
  }
}

function decodePng(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  const luminances = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0, p = 0; i < luminances.length; i++, p += 4) {
    luminances[i] = (png.data[p] + png.data[p + 1] + png.data[p + 2]) / 3;
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminances, png.width, png.height)));
  return new QRCodeReader().decode(bitmap).getText();
}

async function main() {
  const hasMysql = Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD);
  if (!dumpPath && !hasMysql) {
    console.log(JSON.stringify({
      ran: false,
      reason: "No dump and no MYSQL_* credentials. Nothing was queried and nothing was written.",
    }));
    process.exit(2);
  }

  const source = dumpPath ? `dump:${dumpPath}` : "mysql-readonly";
  const rows = dumpPath ? await loadDump(dumpPath) : await loadMysql();
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const copies = new Map<string, number>();
  for (const row of confirmed) {
    const id = String(row.ticketId ?? "").trim();
    if (!id) continue;
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }
  const knownPaths = rows.some((r) => r.path)
    ? new Set(rows.map((r) => r.path).filter((p): p is string => !!p))
    : null;

  const counts: Record<string, number> = {};
  const failures: { reason: DryRunReason; eventId: string; ticketId: string; email: string; path: string }[] = [];
  for (const row of confirmed) {
    const verdict = classifyStoredTicket({
      path: row.path,
      ticketId: row.ticketId,
      eventId: row.eventId,
      email: row.email,
      status: row.status,
      ticketCopies: copies.get(String(row.ticketId ?? "").trim()) ?? 0,
      knownPaths,
    });
    counts[verdict.reason] = (counts[verdict.reason] ?? 0) + 1;
    if (!verdict.ok) {
      failures.push({
        reason: verdict.reason,
        eventId: String(row.eventId ?? ""),
        ticketId: String(row.ticketId ?? ""),
        email: String(row.email ?? ""),
        path: row.path ?? "",
      });
    }
  }

  const samples: Row[] = [];
  const seenEvents = new Set<string>();
  for (const row of confirmed) {
    if (!row.ticketId || !row.eventId || !row.email) continue;
    if (seenEvents.has(row.eventId)) continue;
    seenEvents.add(row.eventId);
    samples.push(row);
    if (samples.length === 3) break;
  }
  const images: { ok: boolean; eventId: string; decoded: boolean }[] = [];
  for (const row of samples) {
    const payload = ticketPayload({
      ticketId: String(row.ticketId),
      eventId: String(row.eventId),
      email: String(row.email),
    });
    const png = await QRCode.toBuffer(payload, { type: "png", margin: 1, width: 320, color: { dark: "#0A0818", light: "#F7EEE4" } });
    let text = "";
    let decoded = false;
    try {
      text = decodePng(png);
      decoded = true;
    } catch {
      decoded = false;
    }
    const parsed = parseTicketPayload(text);
    images.push({
      ok: decoded && !!parsed && parsed.ticketId === row.ticketId && parsed.email === String(row.email).toLowerCase() && parsed.eventId === row.eventId,
      eventId: String(row.eventId),
      decoded,
    });
  }

  const csv = ["reason,eventId,ticketId,email,path", ...failures.map((f) =>
    [f.reason, f.eventId, f.ticketId, f.email, f.path].map(csvCell).join(",")
  )].join("\n");
  const out = "/opt/cursor/artifacts/qr-validity-failures.csv";
  writeFileSync(out, csv + "\n");

  const ok = counts.ok ?? 0;
  console.log(JSON.stringify({
    ran: true,
    source,
    pathsChecked: knownPaths != null,
    confirmed: confirmed.length,
    ok,
    failing: confirmed.length - ok,
    reasons: counts,
    images,
    failuresCsv: out,
    writes: 0,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "QR check failed");
  process.exit(1);
});
