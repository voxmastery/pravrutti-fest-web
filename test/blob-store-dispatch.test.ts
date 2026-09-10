import { describe, it, expect, vi, beforeEach } from "vitest";

/* Proves the seam actually reaches MySQL: same public API, new backend.
   The 9 route/lib consumers and 12 mocking test files depend on these
   signatures being unchanged, so this is the contract test for the swap. */
const sql = vi.hoisted(() => ({ enabled: true, store: new Map<string, unknown>() }));

vi.mock("@/lib/sql-store", () => ({
  SQL_URL_PREFIX: "sql://",
  sqlEnabled: () => sql.enabled,
  sqlListAll: async (prefix: string) =>
    [...sql.store.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((k) => ({ pathname: k, url: "sql://" + k })),
  sqlReadJson: async (p: string) => (sql.store.has(p) ? sql.store.get(p) : null),
  sqlPutJson: async (p: string, d: unknown, o: boolean) => {
    if (!o && sql.store.has(p)) throw new Error("A record already exists at " + p);
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

  /* Losing a registration silently is far worse than a 500, so an
     unconfigured backend must be loud. */
  it("throws rather than silently dropping a write when nothing is configured", async () => {
    sql.enabled = false;
    await expect(putJson("app/x/1.json", { v: 1 }, false)).rejects.toThrow(/no storage backend/i);
  });
});
