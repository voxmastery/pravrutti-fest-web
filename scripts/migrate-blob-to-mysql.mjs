/**
 * One-shot copy of every Vercel Blob document into MySQL.
 *
 * Copy-only by design: nothing is deleted from Blob, so if the cutover has to
 * be rolled back the old backend is still whole. Re-running is safe — every
 * write is an upsert keyed on the blob's pathname.
 *
 * Reads BLOB_READ_WRITE_TOKEN and MYSQL_* from the environment:
 *   node --env-file=.env.local scripts/migrate-blob-to-mysql.mjs
 */
import { list } from "@vercel/blob";
import mysql from "mysql2/promise";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required");
for (const k of ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"])
  if (!process.env[k]) throw new Error(`${k} is required`);

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  connectionLimit: 4,
  charset: "utf8mb4_general_ci",
});

// The schema lives here and in lib/sql-store.ts's documentation only; this is
// the one place that creates it, because the app is deployed after migration.
await pool.execute(
  `CREATE TABLE IF NOT EXISTS kv (
     path VARCHAR(191) NOT NULL PRIMARY KEY,
     data LONGTEXT NOT NULL,
     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
);

// Discoverize's shortlist flag. Additive, and also created at startup
// (lib/discoverize-shortlist-flags.ts) because this script does not re-run
// against the database that is already live. `query` rather than `execute`:
// prepared statements reject some DDL.
await pool.query(
  `CREATE TABLE IF NOT EXISTS discoverize_shortlist (
     lead_email VARCHAR(191) NOT NULL,
     event_id VARCHAR(80) NOT NULL,
     shortlisted TINYINT(1) NOT NULL,
     toggled_by VARCHAR(191) NULL,
     toggled_at VARCHAR(40) NULL,
     PRIMARY KEY (event_id, lead_email)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
);

const all = [];
let cursor;
do {
  const res = await list({ token, cursor, limit: 1000 });
  all.push(...res.blobs);
  cursor = res.hasMore ? res.cursor : undefined;
} while (cursor);

console.log(`found ${all.length} blobs at source`);

let copied = 0, skipped = 0, failed = 0;
for (const b of all) {
  if (b.pathname.length > 191) {
    console.warn("PATH TOO LONG, skipped:", b.pathname);
    skipped++;
    continue;
  }
  try {
    const res = await fetch(`${b.url}?ts=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) { failed++; console.warn("fetch failed", b.pathname, res.status); continue; }
    const text = await res.text();
    JSON.parse(text);                       // refuse to store anything unparseable
    await pool.execute(
      `INSERT INTO kv (path, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [b.pathname, text]
    );
    copied++;
  } catch (e) {
    failed++;
    console.warn("copy failed", b.pathname, e.message);
  }
}

const [[{ n }]] = await pool.execute("SELECT COUNT(*) AS n FROM kv");
const [[{ apps }]] = await pool.execute("SELECT COUNT(*) AS apps FROM kv WHERE path LIKE 'app/%'");
console.log(`\ncopied=${copied} skipped=${skipped} failed=${failed}`);
console.log(`rows in mysql=${n}  applications=${apps}  blobs at source=${all.length}`);
if (failed > 0 || copied + skipped !== all.length) {
  console.error("\nMISMATCH — do not cut over until this reconciles.");
  process.exitCode = 1;
}
await pool.end();
