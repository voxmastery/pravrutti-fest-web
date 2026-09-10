# Hostinger MySQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move fest-web's storage from Vercel Blob to Hostinger MySQL and run the Next.js app on Hostinger Premium hosting at `pravrutti.tech`, with zero loss of live registration data.

**Architecture:** `lib/blob-store.ts` is already the single storage seam — all 9 consumers and 12 test files go through its public API. We keep that API byte-identical and swap its internals to a new `lib/sql-store.ts` backed by one MySQL key/value table (`path` → JSON text). The three routes that still call `@vercel/blob` directly get rerouted through the seam. A one-shot script copies every live blob into MySQL before cutover.

**Tech Stack:** Next.js 16.2 (Node runtime), `mysql2/promise`, MySQL on Hostinger (`srv844.hstgr.io`, db `u456915230_pravrutti`), Vitest.

**Spec:** none written — requirements are captured in this plan's Global Constraints and were established by direct inspection of the running system on 2026-09-10 (see `.claude` memory `fest-hosting-migration-blockers`).

## Global Constraints

- **`putJson(path, data, overwrite=false)` MUST throw when the key already exists.** This is the duplicate-registration guard, relied on at `app/api/register/route.ts:195`, `app/api/teams/route.ts:225`, `:238`, `:319`. Losing it would let one person register twice for one event.
- **The public API of `lib/blob-store.ts` must not change.** Exported names and signatures stay exactly: `listAll`, `readPrivate`, `emailScopedKey`, `applicationPath`, `gatePath`, `teamPath`, `teamMemberPath`, `readJsonByPath`, `putJson`, `listTeamMembers`.
- **Dev fallback stays first in the dispatch chain.** `useDevBlob()` must keep winning over MySQL so local dev needs no database.
- **Never commit secrets.** DB credentials live in `.env.local` (gitignored) and Hostinger env vars. Never in `.env.example`, never in a plan, never in a test.
- **Storage paths are unchanged.** `app/<eventId>/<hash>.json`, `gate/<hash>.json`, `team/<eventId>/<code>.json`, `team-member/<eventId>/<hash>.json`. The migration is a backend swap, not a reshape.
- **Node version on Hostinger: 22.** App type `next`. Username `u456915230`, domain `pravrutti.tech`.
- **Existing 231 tests must stay green** at every commit.

---

### Task 1: MySQL key/value store

**Files:**
- Create: `lib/sql-store.ts`
- Create: `test/sql-store.test.ts`
- Modify: `package.json` (add `mysql2`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sqlEnabled(): boolean`, `SQL_URL_PREFIX: string`, `sqlListAll(prefix: string): Promise<{pathname:string,url:string}[]>`, `sqlReadJson(path: string): Promise<unknown|null>`, `sqlPutJson(path: string, data: unknown, overwrite: boolean): Promise<void>`, `closeSqlPool(): Promise<void>`.
- Note: the `CREATE TABLE` lives **only** in Task 4's migration script, which always runs before the app is deployed. Do not add a schema-ensure call here — it would be dead code on every request.

- [ ] **Step 1: Install the driver**

```bash
cd /home/voxmastery/Desktop/fest-web && npm install mysql2@^3.11.0
```

- [ ] **Step 2: Write the failing test**

Create `test/sql-store.test.ts`. These tests use a fake pool so they need no database:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const rows: { path: string; data: string }[] = [];
const execute = vi.fn(async (sql: string, params: any[] = []) => {
  if (/^INSERT/i.test(sql)) {
    const [path, data] = params;
    const existing = rows.find((r) => r.path === path);
    if (existing) {
      if (/ON DUPLICATE KEY/i.test(sql)) { existing.data = data; return [{ affectedRows: 2 }]; }
      return [{ affectedRows: 0 }];            // INSERT IGNORE hit a duplicate
    }
    rows.push({ path, data });
    return [{ affectedRows: 1 }];
  }
  if (/WHERE path = \?/.test(sql)) {
    const found = rows.find((r) => r.path === params[0]);
    return [found ? [{ data: found.data }] : []];
  }
  if (/LIKE/.test(sql)) {
    const prefix = String(params[0]).replace(/%$/, "");
    return [rows.filter((r) => r.path.startsWith(prefix)).map((r) => ({ path: r.path }))];
  }
  return [[]];
});

vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ execute, end: async () => {} }) },
  createPool: () => ({ execute, end: async () => {} }),
}));

import { sqlListAll, sqlReadJson, sqlPutJson, SQL_URL_PREFIX, sqlEnabled } from "@/lib/sql-store";

beforeEach(() => { rows.length = 0; execute.mockClear(); process.env.MYSQL_HOST = "h"; process.env.MYSQL_DATABASE = "d"; process.env.MYSQL_USER = "u"; process.env.MYSQL_PASSWORD = "p"; });

describe("sql-store", () => {
  it("is enabled only when every connection variable is present", () => {
    expect(sqlEnabled()).toBe(true);
    delete process.env.MYSQL_PASSWORD;
    expect(sqlEnabled()).toBe(false);
  });

  it("round-trips a JSON document", async () => {
    await sqlPutJson("app/robo-race/abc.json", { name: "Asha" }, false);
    expect(await sqlReadJson("app/robo-race/abc.json")).toEqual({ name: "Asha" });
  });

  it("returns null for a path that does not exist", async () => {
    expect(await sqlReadJson("app/nope/none.json")).toBeNull();
  });

  /* The duplicate-registration guard. register/teams call putJson(..., false)
     and treat a throw as "already applied" — so this must reject, not
     silently no-op. */
  it("throws when overwrite is false and the key exists", async () => {
    await sqlPutJson("app/robo-race/abc.json", { v: 1 }, false);
    await expect(sqlPutJson("app/robo-race/abc.json", { v: 2 }, false)).rejects.toThrow(/exists/i);
    expect(await sqlReadJson("app/robo-race/abc.json")).toEqual({ v: 1 });
  });

  it("replaces the document when overwrite is true", async () => {
    await sqlPutJson("app/robo-race/abc.json", { v: 1 }, false);
    await sqlPutJson("app/robo-race/abc.json", { v: 2 }, true);
    expect(await sqlReadJson("app/robo-race/abc.json")).toEqual({ v: 2 });
  });

  it("lists by prefix and hands back resolvable urls", async () => {
    await sqlPutJson("app/robo-race/a.json", { n: 1 }, false);
    await sqlPutJson("app/robo-race/b.json", { n: 2 }, false);
    await sqlPutJson("gate/zz.json", { n: 3 }, false);
    const found = await sqlListAll("app/robo-race/");
    expect(found.map((f) => f.pathname).sort()).toEqual(["app/robo-race/a.json", "app/robo-race/b.json"]);
    expect(found[0].url.startsWith(SQL_URL_PREFIX)).toBe(true);
  });

  it("escapes LIKE wildcards in a prefix so they match literally", async () => {
    await sqlPutJson("app/a_b/x.json", { n: 1 }, false);
    await sqlPutJson("app/axb/y.json", { n: 2 }, false);
    const found = await sqlListAll("app/a_b/");
    expect(found.map((f) => f.pathname)).toEqual(["app/a_b/x.json"]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd /home/voxmastery/Desktop/fest-web && npx vitest run test/sql-store.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sql-store'`.

- [ ] **Step 4: Write `lib/sql-store.ts`**

```ts
import mysql from "mysql2/promise";

/**
 * MySQL-backed key/value store. One table, `path` → JSON text, which is the
 * shape the app already had on Vercel Blob — so this is a backend swap, not a
 * data model change.
 *
 * Unlike Blob, MySQL gives real atomicity: `INSERT` either wins or it does
 * not, so the duplicate-registration guard is enforced by the database rather
 * than by a read-then-write race.
 */
export const SQL_URL_PREFIX = "sql://";

const TABLE = "kv";

export function sqlEnabled(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
      process.env.MYSQL_DATABASE &&
      process.env.MYSQL_USER &&
      process.env.MYSQL_PASSWORD
  );
}

let pool: any = null;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_POOL_SIZE ?? 5),
      charset: "utf8mb4_general_ci",
    });
  }
  return pool;
}

export async function closeSqlPool() {
  if (pool) { await pool.end(); pool = null; }
}

/* `_` and `%` are wildcards to LIKE, and event ids contain neither today —
   but a future id with an underscore would silently over-match, so escape. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function sqlListAll(prefix: string) {
  const [rows]: any = await getPool().execute(
    `SELECT path FROM \`${TABLE}\` WHERE path LIKE ? ESCAPE '\\\\'`,
    [`${escapeLike(prefix)}%`]
  );
  return (rows as { path: string }[]).map((r) => ({
    pathname: r.path,
    url: `${SQL_URL_PREFIX}${r.path}`,
  }));
}

export async function sqlReadJson(path: string) {
  const [rows]: any = await getPool().execute(
    `SELECT data FROM \`${TABLE}\` WHERE path = ?`,
    [path]
  );
  const row = (rows as { data: string }[])[0];
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

export async function sqlPutJson(path: string, data: unknown, overwrite: boolean) {
  const json = JSON.stringify(data);
  if (overwrite) {
    await getPool().execute(
      `INSERT INTO \`${TABLE}\` (path, data) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [path, json]
    );
    return;
  }
  // INSERT IGNORE reports 0 affected rows when the key was already taken.
  // Turning that into a throw preserves the contract the register and teams
  // routes rely on to detect "already applied".
  const [res]: any = await getPool().execute(
    `INSERT IGNORE INTO \`${TABLE}\` (path, data) VALUES (?, ?)`,
    [path, json]
  );
  if (!res || res.affectedRows === 0) {
    throw new Error(`A record already exists at ${path}`);
  }
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run test/sql-store.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/voxmastery/Desktop/fest-web
git add lib/sql-store.ts test/sql-store.test.ts package.json package-lock.json
git commit -m "feat(storage): MySQL key/value store behind the blob-store contract"
```

---

### Task 2: Dispatch blob-store to MySQL

**Files:**
- Modify: `lib/blob-store.ts` (all of it)
- Create: `test/blob-store-dispatch.test.ts`

**Interfaces:**
- Consumes: `sqlEnabled`, `sqlListAll`, `sqlReadJson`, `sqlPutJson`, `SQL_URL_PREFIX` from Task 1.
- Produces: unchanged public API of `lib/blob-store.ts` — no consumer changes.

- [ ] **Step 1: Write the failing test**

Create `test/blob-store-dispatch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sql = vi.hoisted(() => ({ enabled: true, store: new Map<string, unknown>() }));

vi.mock("@/lib/sql-store", () => ({
  SQL_URL_PREFIX: "sql://",
  sqlEnabled: () => sql.enabled,
  sqlListAll: async (prefix: string) =>
    [...sql.store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: "sql://" + k })),
  sqlReadJson: async (p: string) => (sql.store.has(p) ? sql.store.get(p) : null),
  sqlPutJson: async (p: string, d: unknown, o: boolean) => {
    if (!o && sql.store.has(p)) throw new Error("exists");
    sql.store.set(p, d);
  },
}));

// The dev filesystem fallback must keep winning over MySQL.
vi.mock("@/lib/dev-blob", () => ({
  DEV_URL_PREFIX: "dev://",
  useDevBlob: () => false,
  devListAll: async () => [],
  devReadJson: async () => null,
  devPutJson: async () => {},
}));

import { listAll, readPrivate, readJsonByPath, putJson, listTeamMembers } from "@/lib/blob-store";

beforeEach(() => { sql.enabled = true; sql.store.clear(); });

describe("blob-store dispatches to MySQL", () => {
  it("writes and reads back through the seam", async () => {
    await putJson("app/x/1.json", { name: "Asha" }, false);
    expect(await readJsonByPath("app/x/1.json")).toEqual({ name: "Asha" });
  });

  it("resolves a sql:// url handed back by listAll", async () => {
    await putJson("app/x/1.json", { name: "Asha" }, false);
    const [first] = await listAll("app/x/");
    expect(await readPrivate(first.url)).toEqual({ name: "Asha" });
  });

  it("keeps the duplicate guard", async () => {
    await putJson("app/x/1.json", { v: 1 }, false);
    await expect(putJson("app/x/1.json", { v: 2 }, false)).rejects.toThrow();
  });

  it("builds a team roster from per-member records, ordered by joinedAt", async () => {
    await putJson("team-member/ev/a.json", { code: "AAA", member: { name: "Bina", joinedAt: "2026-01-02" } }, false);
    await putJson("team-member/ev/b.json", { code: "AAA", member: { name: "Asha", joinedAt: "2026-01-01" } }, false);
    await putJson("team-member/ev/c.json", { code: "ZZZ", member: { name: "Ravi", joinedAt: "2026-01-03" } }, false);
    const roster = await listTeamMembers("ev", "AAA");
    expect(roster.map((m: any) => m.name)).toEqual(["Asha", "Bina"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/blob-store-dispatch.test.ts`
Expected: FAIL — `readPrivate` still tries to `fetch()` the `sql://` url.

- [ ] **Step 3: Rewrite `lib/blob-store.ts`**

Replace the whole file:

```ts
import { createHash } from "crypto";
import {
  useDevBlob,
  devListAll,
  devReadJson,
  devPutJson,
  DEV_URL_PREFIX,
} from "@/lib/dev-blob";
import {
  sqlEnabled,
  sqlListAll,
  sqlReadJson,
  sqlPutJson,
  SQL_URL_PREFIX,
} from "@/lib/sql-store";

/**
 * Storage seam. Three backends, tried in this order:
 *   1. dev filesystem  — local work needs no database
 *   2. MySQL           — production on Hostinger
 *   3. nothing         — throws, rather than silently losing a registration
 *
 * The public API here is the contract 9 route/lib consumers and 12 test files
 * depend on, so it does not change when the backend does.
 */

const noBackend = (): never => {
  throw new Error(
    "No storage backend configured. Set MYSQL_HOST/DATABASE/USER/PASSWORD."
  );
};

export async function listAll(prefix: string) {
  if (useDevBlob()) return devListAll(prefix);
  if (sqlEnabled()) return sqlListAll(prefix);
  return noBackend();
}

export async function readPrivate(url: string) {
  if (url.startsWith(DEV_URL_PREFIX)) return devReadJson(url.slice(DEV_URL_PREFIX.length));
  if (url.startsWith(SQL_URL_PREFIX)) return sqlReadJson(url.slice(SQL_URL_PREFIX.length));
  return null;
}

export function emailScopedKey(eventId: string, email: string) {
  return createHash("sha256").update(`${eventId}:${email.toLowerCase()}`).digest("hex").slice(0, 24);
}

export function applicationPath(eventId: string, email: string) {
  return `app/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

/**
 * Fest entry, recorded once per person rather than per registration.
 *
 * Keyed on email alone — the gate asks "has this human come through the
 * door", which is a different question from "did they turn up to Robo Race".
 * Keeping them apart means an organiser admitting someone at the entrance
 * never overwrites, or stands in for, a coordinator's event check-in.
 */
export function gatePath(email: string) {
  return `gate/${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}.json`;
}

export function teamPath(eventId: string, code: string) {
  return `team/${eventId}/${code}.json`;
}

export function teamMemberPath(eventId: string, email: string) {
  return `team-member/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

export async function readJsonByPath(path: string) {
  if (useDevBlob()) return devReadJson(path);
  if (sqlEnabled()) return sqlReadJson(path);
  return noBackend();
}

/** `overwrite: false` throws when the key exists — the duplicate guard. */
export async function putJson(path: string, data: unknown, overwrite: boolean) {
  if (useDevBlob()) return devPutJson(path, data);
  if (sqlEnabled()) return sqlPutJson(path, data, overwrite);
  return noBackend();
}

/**
 * Roster derived from per-member records rather than the team blob's own
 * `members[]`. Each member owns one row keyed by their email, so simultaneous
 * joins touch different keys and cannot clobber one another.
 */
export async function listTeamMembers(eventId: string, code: string) {
  const rows = await listAll(`team-member/${eventId}/`);
  const records = await Promise.all(rows.map((b) => readPrivate(b.url)));
  return records
    .filter((r: any) => r && r.code === code && r.member)
    .map((r: any) => r.member)
    .sort((a: any, b: any) => String(a.joinedAt).localeCompare(String(b.joinedAt)));
}
```

- [ ] **Step 4: Run the new test and the whole suite**

Run: `npx vitest run test/blob-store-dispatch.test.ts && npx vitest run`
Expected: new file PASSES; full suite still 231+ passing, 0 failing.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/blob-store.ts test/blob-store-dispatch.test.ts
git commit -m "refactor(storage): route blob-store through MySQL, drop Vercel Blob"
```

---

### Task 3: Reroute the three direct Vercel Blob callers

**Files:**
- Modify: `app/api/contact/route.ts` (line 2 import, line 42 `put`)
- Modify: `app/api/status/route.ts` (line 2 import, line 63 `list`)
- Modify: `app/api/admin/route.ts` (line 2 import, lines 30, 83, 101)

**Interfaces:**
- Consumes: `listAll`, `readJsonByPath`, `putJson` from Task 2's `lib/blob-store`.
- Produces: no `@vercel/blob` import anywhere in the repo.

- [ ] **Step 1: Write the failing test**

Create `test/no-vercel-blob.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* Vercel Blob is gone. If an import comes back, the app silently depends on a
   vendor we no longer pay for and writes land somewhere nobody reads. */
function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("Vercel Blob is fully removed", () => {
  it("has no @vercel/blob import in app/ or lib/", () => {
    const offenders = [...walk("app"), ...walk("lib")].filter((f) =>
      readFileSync(f, "utf8").includes("@vercel/blob")
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/no-vercel-blob.test.ts`
Expected: FAIL listing `app/api/contact/route.ts`, `app/api/status/route.ts`, `app/api/admin/route.ts`.

- [ ] **Step 3: Rewrite the three call sites**

In `app/api/contact/route.ts` — replace the import and the `put` call:

```ts
// was: import { put } from "@vercel/blob";
import { putJson } from "@/lib/blob-store";
```

```ts
// was: await put(path, JSON.stringify(body), {...})
await putJson(path, body, false);
```

In `app/api/status/route.ts` — delete the `@vercel/blob` import on line 2 and add `readJsonByPath` to the existing `@/lib/blob-store` import. Then replace the whole batch body at lines 60-67. It was a two-step list-then-fetch; it collapses to one lookup, and `null` already means "not found" in both worlds:

```ts
  const found: any[] = [];
  const CHUNK = 12;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const batch = await Promise.all(
      paths.slice(i, i + CHUNK).map((p) => readJsonByPath(p))
    );
    for (const r of batch) if (r) found.push(r as Application);
  }
```

`readPrivate` is no longer used in this file — remove it from the import if it becomes unused, or the build will warn.

In `app/api/admin/route.ts` — replace the import and all three calls:

```ts
// was: import { list, put } from "@vercel/blob";
import { listAll, readJsonByPath, putJson } from "@/lib/blob-store";
```

```ts
// line ~30, the paginated listing loop collapses to one call:
const blobs = await listAll(prefix);

// line ~83, the single-record lookup:
const record = await readJsonByPath(path);

// line ~101, the write:
await putJson(path, record, true);
```

- [ ] **Step 4: Run the guard test, the suite, and the type-checker**

Run: `npx vitest run test/no-vercel-blob.test.ts && npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, no type errors.

- [ ] **Step 5: Leave the dependency installed for now**

`@vercel/blob` stays in `package.json` until Task 4 has copied every blob
across — the migration script is the one remaining legitimate reader of it.
Uninstalling here would break that script. The `npm uninstall @vercel/blob`
and the matching `package.json` assertion in `test/no-vercel-blob.test.ts`
belong to Task 4's final commit.

Run the build to confirm the app itself no longer needs it:

```bash
cd /home/voxmastery/Desktop/fest-web && npx next build
```
Expected: build succeeds with no `@vercel/blob` resolution in app or lib.

- [ ] **Step 6: Commit**

```bash
git add app/api/contact/route.ts app/api/status/route.ts app/api/admin/route.ts test/no-vercel-blob.test.ts package.json package-lock.json
git commit -m "refactor(storage): reroute contact, status and admin off Vercel Blob"
```

---

### Task 4: Migrate the live data

**Files:**
- Create: `scripts/migrate-blob-to-mysql.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks — the script is plain `.mjs` and cannot import the TypeScript module, so it carries its own copy of the `CREATE TABLE`. That duplication is deliberate and is the only other place the schema appears.
- Produces: a populated `kv` table; a printed reconciliation count the operator must check before cutover.

**This task touches real registrations. It is copy-only — it never deletes from Vercel Blob, so Vercel remains a working fallback until DNS moves.**

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-blob-to-mysql.mjs`:

```js
/**
 * One-shot copy of every Vercel Blob document into MySQL.
 *
 * Copy-only by design: nothing is deleted from Blob, so if the cutover has to
 * be rolled back the old backend is still whole. Re-running is safe — every
 * write is an upsert.
 *
 * Reads BLOB_READ_WRITE_TOKEN and the MYSQL_* variables from the environment.
 * Run with:  node --env-file=.env.local scripts/migrate-blob-to-mysql.mjs
 */
import { list } from "@vercel/blob";
import mysql from "mysql2/promise";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  connectionLimit: 4,
  charset: "utf8mb4_general_ci",
});

await pool.execute(
  `CREATE TABLE IF NOT EXISTS kv (
     path VARCHAR(191) NOT NULL PRIMARY KEY,
     data LONGTEXT NOT NULL,
     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
);

const all = [];
let cursor;
do {
  const res = await list({ token, cursor, limit: 1000 });
  all.push(...res.blobs);
  cursor = res.hasMore ? res.cursor : undefined;
} while (cursor);

console.log(`found ${all.length} blobs`);

let copied = 0, skipped = 0, failed = 0;
for (const b of all) {
  if (b.pathname.length > 191) { console.warn("PATH TOO LONG, skipped:", b.pathname); skipped++; continue; }
  try {
    const res = await fetch(`${b.url}?ts=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) { failed++; console.warn("fetch failed", b.pathname, res.status); continue; }
    const text = await res.text();
    JSON.parse(text);                     // refuse to store anything unparseable
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
```

- [ ] **Step 2: Put the database credentials in `.env.local`**

Append to `/home/voxmastery/Desktop/fest-web/.env.local` (gitignored — verify with `git check-ignore .env.local`):

```
MYSQL_HOST=srv844.hstgr.io
MYSQL_PORT=3306
MYSQL_DATABASE=u456915230_pravrutti
MYSQL_USER=u456915230_pravrutti
MYSQL_PASSWORD=<from scratchpad/db.json>
```

Also add `BLOB_READ_WRITE_TOKEN=<value>` — pull it with `npx vercel env pull --environment=production <tmpfile>`; it is the one variable Vercel will export.

- [ ] **Step 3: Dry-run the count against Blob before writing anything**

Run: `node --env-file=.env.local -e "const {list}=await import('@vercel/blob'); const r=await list({token:process.env.BLOB_READ_WRITE_TOKEN,limit:1000}); console.log('blobs:',r.blobs.length, 'apps:', r.blobs.filter(b=>b.pathname.startsWith('app/')).length)"`
Expected: a non-zero count. Write it down — Step 5 must match it.

- [ ] **Step 4: Run the migration**

Run: `cd /home/voxmastery/Desktop/fest-web && node --env-file=.env.local scripts/migrate-blob-to-mysql.mjs`
Expected: `copied=N skipped=0 failed=0`, and `rows in mysql` equal to `blobs at source`.

- [ ] **Step 5: Verify the app reads the migrated data**

Run: `npm run dev` with the MYSQL_* vars set and `BLOB_READ_WRITE_TOKEN` **removed** from the environment, then open `/dashboard/applications` as an organiser.
Expected: the same application count as production shows today. If the list is empty, stop — the dispatch or the migration is wrong.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-blob-to-mysql.mjs
git commit -m "feat(storage): one-shot Vercel Blob to MySQL migration script"
```

---

### Task 5: Deploy to Hostinger

**Files:**
- Create: `.hostingerignore` (or reuse `.gitignore` semantics when archiving)
- Modify: `next.config.mjs` (add `output: "standalone"` only if the Hostinger build requires it — verify first)

**Interfaces:**
- Consumes: a green build from Task 3 and a populated database from Task 4.
- Produces: the app served by Hostinger at `pravrutti.tech`.

**Facts already established (do not re-derive):** hosting username `u456915230`, order `1009999598`, domain `pravrutti.tech`, root `/home/u456915230/domains/pravrutti.tech/public_html`, datacenter `mumbai`, MySQL `srv844.hstgr.io` / `u456915230_pravrutti`.

- [ ] **Step 1: Set the environment variables on Hostinger**

Use the MCP tool `hosting_replaceNode_jsEnvironmentVariablesV1` with `username: "u456915230"`, `domain: "pravrutti.tech"` and every variable the app needs:

`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`NEXTAUTH_URL=https://pravrutti.tech`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `ADMIN_KEY`, `ORGANISER_EMAILS`.

`MYSQL_HOST` should be `localhost` for the deployed app (same machine) — `srv844.hstgr.io` is only for remote migration.
Do **not** set `BLOB_READ_WRITE_TOKEN`; its absence is what proves Vercel Blob is unused.

- [ ] **Step 2: Archive the source (no build output, no node_modules)**

```bash
cd /home/voxmastery/Desktop/fest-web
git archive --format=tar.gz -o /tmp/claude-1000/pravrutti-src.tar.gz HEAD
```
Using `git archive` guarantees the archive contains exactly the tracked files — no `.next`, no `node_modules`, no `.env.local`.

- [ ] **Step 3: Deploy**

Call `hosting_deployJsApplication` with `domain: "pravrutti.tech"` and `archivePath: "/tmp/claude-1000/pravrutti-src.tar.gz"`.

- [ ] **Step 4: Configure the Node build**

Call `hosting_startNode_jsBuildV1` with exactly:

```json
{
  "username": "u456915230",
  "domain": "pravrutti.tech",
  "node_version": 22,
  "app_type": "next",
  "root_directory": ".",
  "output_directory": ".next",
  "build_script": "npm run build",
  "source_type": "archive",
  "source_options": { "archive_path": "pravrutti-src.tar.gz" }
}
```

`source_type` only accepts `"archive"`. `archive_path` is relative to the vhost document root (`/home/u456915230/domains/pravrutti.tech/public_html`), **not** an absolute path on your laptop — Task 5 Step 3 is what puts the file there.

**WARNING from the API:** this overwrites the website's contents and cannot be undone. The site is empty at this point, so that is safe — but never run it against a populated site without a backup.

- [ ] **Step 5: Watch the deployment and read the logs**

Call `hosting_listJsDeployments` with `domain: "pravrutti.tech"` until the state is `completed`. On `failed`, call `hosting_getNodeJSBuildLogsV1` and `hosting_analyseFailedNode_jsBuildV1`.

- [ ] **Step 6: Smoke-test over HTTP before touching DNS**

Run: `curl -sI https://pravrutti.tech/ | head -1` and `curl -s https://pravrutti.tech/api/status -o /dev/null -w '%{http_code}\n'`
Expected: `200` for the homepage. Then sign in and confirm `/dashboard/applications` lists the migrated registrations.

- [ ] **Step 7: Commit any config change**

```bash
git add next.config.mjs
git commit -m "chore(deploy): Hostinger Node build configuration"
```

---

### Task 6: Cut the domain over

**Files:** none — this is infrastructure.

**Interfaces:**
- Consumes: a verified-working app from Task 5.
- Produces: `https://pravrutti.tech` serving the fest site.

- [ ] **Step 1: Confirm the app answers on Hostinger first**

Do not proceed until Task 5 Step 6 returned `200` and the dashboard showed real data. DNS is the last step, never the first.

- [ ] **Step 2: Add the Google OAuth redirect URI**

**This step is the user's — Claude must not sign in to Google on their behalf.**
In Google Cloud Console → Credentials → the OAuth client whose id is `GOOGLE_CLIENT_ID`, add to *Authorized redirect URIs*:
`https://pravrutti.tech/api/auth/callback/google`
and to *Authorized JavaScript origins*: `https://pravrutti.tech`.
Sign-in will fail with `redirect_uri_mismatch` until this is saved.

- [ ] **Step 3: Point the DNS records**

The domain already uses Hostinger nameservers (`apollo.dns-parking.com`, `athena.dns-parking.com`), so records are managed through `DNS_updateDNSRecordsV1` for `pravrutti.tech`. Creating the website should have populated an `A` record to the hosting IP — verify with `DNS_getDNSRecordsV1` and only add what is missing.

- [ ] **Step 4: Verify end to end**

```bash
nslookup pravrutti.tech
curl -sI https://pravrutti.tech | head -1
```
Then in a browser: sign in with Google, open `/dashboard/applications`, confirm the registration count matches, and scan a ticket at `/dashboard/scan`.

- [ ] **Step 5: Leave Vercel running**

Do not delete the Vercel project or its Blob store. Keep both until the fest is over — they are the rollback path, and Blob still holds an untouched copy of every registration.

---

## Rollback

At any point before Task 6, rollback is: do nothing. `fest-web-main.vercel.app` keeps serving from Vercel Blob, which the migration never modified.

After Task 6, rollback is: point DNS back / use the Vercel URL, and re-run Task 4's script to copy any registrations taken on MySQL since cutover back into Blob (the script is upsert-based; reverse the source and destination).
