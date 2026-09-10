import { describe, it, expect, vi, beforeEach } from "vitest";

/* A fake pool, so these run with no database. What is being pinned down is
   the contract the app depends on — especially that a non-overwrite write to
   an existing key REJECTS, which is the duplicate-registration guard. */
/* `vi.hoisted` because vi.mock is lifted to the top of the file — a plain
   const would not exist yet when the factory runs. */
const fake = vi.hoisted(() => {
  const rows: { path: string; data: string }[] = [];
  const execute = async (sql: string, params: any[] = []) => {
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
      // Mirror MySQL's ESCAPE '\' handling: unescape, then plain prefix match.
      const raw = String(params[0]).replace(/%$/, "").replace(/\\(.)/g, "$1");
      return [rows.filter((r) => r.path.startsWith(raw)).map((r) => ({ path: r.path }))];
    }
    return [[]];
  };
  return { rows, execute };
});

vi.mock("mysql2/promise", () => {
  const pool = { execute: fake.execute, end: async () => {} };
  return { default: { createPool: () => pool }, createPool: () => pool };
});

import { sqlListAll, sqlReadJson, sqlPutJson, SQL_URL_PREFIX, sqlEnabled } from "@/lib/sql-store";

beforeEach(() => {
  fake.rows.length = 0;
  process.env.MYSQL_HOST = "h";
  process.env.MYSQL_DATABASE = "d";
  process.env.MYSQL_USER = "u";
  process.env.MYSQL_PASSWORD = "p";
});

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

  /* register/teams call putJson(..., false) and treat a throw as "already
     applied" — this must reject, not silently no-op. */
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
