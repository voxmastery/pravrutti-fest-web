import mysql from "mysql2/promise";

/**
 * MySQL-backed key/value store.
 *
 * One table, `path` -> JSON text, which is the shape the app already had on
 * Vercel Blob — so this is a backend swap, not a data model change. Every
 * storage path (`app/...`, `gate/...`, `team/...`, `team-member/...`) is
 * carried over verbatim.
 *
 * Unlike Blob, MySQL gives real atomicity: an INSERT either wins or it does
 * not. The duplicate-registration guard is therefore enforced by the database
 * rather than by a read-then-write race that two simultaneous applicants
 * could both pass.
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
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/* `_` and `%` are wildcards to LIKE. No event id contains either today, but
   one that did would silently over-match and leak another event's roster
   into this one, so escape rather than trust the data. */
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
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
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
  // routes rely on to detect "this person has already applied".
  const [res]: any = await getPool().execute(
    `INSERT IGNORE INTO \`${TABLE}\` (path, data) VALUES (?, ?)`,
    [path, json]
  );
  if (!res || res.affectedRows === 0) {
    throw new Error(`A record already exists at ${path}`);
  }
}

/** Removes one record. Used only by the organiser's test-data removal, which
    keeps a copy of everything it deletes (see lib/purge.ts). */
export async function sqlDeleteJson(path: string) {
  await getPool().execute(`DELETE FROM \`${TABLE}\` WHERE path = ?`, [path]);
}

export type CasResult<T> = { current: T | null; written: boolean; next: T | null };

/**
 * Read a row, decide, and write, while holding the row lock.
 *
 * Two Node processes can both pass a read-then-write. `FOR UPDATE` makes the
 * second wait until the first commits, so it sees the stamp and does not
 * write another one. The decision runs inside the lock for that reason.
 */
export async function sqlCasUpdate<T>(
  path: string,
  decide: (current: T | null) => { write: boolean; next: T | null } | Promise<{ write: boolean; next: T | null }>
): Promise<CasResult<T>> {
  return sqlWithTransaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT data FROM \`${TABLE}\` WHERE path = ? FOR UPDATE`,
      [path]
    );
    const row = (rows as { data: string }[])[0];
    let current: T | null = null;
    if (row) {
      try {
        current = JSON.parse(row.data) as T;
      } catch {
        current = null;
      }
    }
    const decision = await decide(current);
    if (!decision.write || decision.next == null) {
      return { current, written: false, next: current };
    }
    const json = JSON.stringify(decision.next);
    if (row) {
      await conn.execute(`UPDATE \`${TABLE}\` SET data = ? WHERE path = ?`, [json, path]);
    } else {
      await conn.execute(`INSERT INTO \`${TABLE}\` (path, data) VALUES (?, ?)`, [path, json]);
    }
    return { current, written: true, next: decision.next };
  });
}

/**
 * Parameterised statements, and plain queries for DDL.
 *
 * mysql2's prepared-statement protocol rejects some DDL, so a CREATE TABLE
 * goes through `query`. Everything that binds values uses `execute`.
 */
export async function sqlExecute(sql: string, params: unknown[] = []) {
  return getPool().execute(sql, params);
}

export async function sqlQuery(sql: string, params: unknown[] = []) {
  return getPool().query(sql, params);
}

/** A connection inside an open transaction. `execute` matches mysql2's. */
export type SqlTxConn = {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
};

/**
 * BEGIN … COMMIT around `fn`. A throw rolls back.
 *
 * DDL must not run in here: MySQL commits implicitly on CREATE TABLE, which
 * would release the row lock this exists to hold.
 */
export async function sqlWithTransaction<T>(fn: (conn: SqlTxConn) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* The connection may already be closed. The original error is the one that matters. */
    }
    throw err;
  } finally {
    conn.release();
  }
}
