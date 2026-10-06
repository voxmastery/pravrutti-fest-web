import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Registering the teammates leads added before added meant joined.
 *
 * Until 6 Oct 2026 a teammate the lead added had no registration until they
 * clicked their invite, and most invites never arrived: 379 sat as "Invite
 * not accepted", 169 on confirmed teams. The organisers' call is that the
 * lead adding them was enough, so this registers them as the add itself now
 * does — covered by the lead, confirmed if the team is — without sending a
 * flood of mail through a mailbox already at its limit.
 */

const store = new Map<string, any>();
const mailed: string[] = [];
vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k, pathname: k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "chaos", BY = "org@example.com";
const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const run = (over: Record<string, unknown> = {}) => post({ action: "add_invited", by: BY, ...over });

const team = (code: string, lead: string, over: Record<string, unknown> = {}) =>
  store.set(`team/${EV}/${code}.json`, { code, eventId: EV, name: "Team " + code, bio: "", createdByEmail: lead, members: [], createdAt: "2026-10-01T00:00:00Z", ...over });
const leadApp = (email: string, code: string, status: string) =>
  store.set(`app/${EV}/${email}.json`, { ticketId: "PRV-L", eventId: EV, eventName: "CHAOS", status, payment: status === "confirmed" ? "paid" : "awaiting", fee: "Rs. 200/-", name: "Lead", email, phone: "9000000000", college: "RUAS", teamName: "Team " + code, teamCode: code, members: null, appliedAt: "2026-10-01T00:00:00Z" });
const invited = (email: string, code: string, over: Record<string, unknown> = {}) =>
  store.set(`team-member/${EV}/${email}.json`, { code, eventId: EV, member: { name: email.split("@")[0], email, phone: "9111111111", college: "BMS", joinedAt: "", invitedAt: "2026-10-02T00:00:00Z", inviteToken: "t".repeat(64), ...over } });
const app = (email: string) => store.get(`app/${EV}/${email}.json`);
const member = (email: string) => store.get(`team-member/${EV}/${email}.json`)?.member;

beforeEach(() => {
  store.clear(); mailed.length = 0;
  team("CONFIRMED001", "lead1@x.com"); leadApp("lead1@x.com", "CONFIRMED001", "confirmed");
  team("INREVIEW001", "lead2@x.com"); leadApp("lead2@x.com", "INREVIEW001", "pending");
  invited("chitra@x.com", "CONFIRMED001");
  invited("hitha@x.com", "INREVIEW001");
});

describe("POST /api/admin/reconcile { action: add_invited }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "add_invited", by: BY }, null)).status).toBe(401);
  });

  it("refuses without naming the organiser who decided", async () => {
    expect((await run({ by: "" })).status).toBe(400);
  });

  it("only reports on a dry run", async () => {
    const res = await run({ dryRun: true });
    expect(res.body.wouldAdd).toBe(2);
    expect(app("chitra@x.com")).toBeUndefined();
  });

  it("registers a teammate on a confirmed team as confirmed", async () => {
    await run();
    expect(app("chitra@x.com")).toMatchObject({
      status: "confirmed", payment: "not_required", fee: "Covered by team lead",
      teamCode: "CONFIRMED001", teamName: "Team CONFIRMED001", phone: "9111111111", college: "BMS", addedByLead: true,
    });
  });

  it("registers a teammate on a team in review as in review", async () => {
    await run();
    expect(app("hitha@x.com")).toMatchObject({ status: "pending", payment: "not_required" });
  });

  it("marks them joined on the roster", async () => {
    await run();
    expect(member("chitra@x.com").acceptedAt).toBeTruthy();
    expect(member("chitra@x.com").inviteToken).toBeUndefined();
  });

  it("sends no email", async () => {
    await run();
    expect(mailed).toEqual([]);
  });

  it("leaves alone anyone who already has a registration at the event", async () => {
    store.set(`app/${EV}/hitha@x.com.json`, { email: "hitha@x.com", eventId: EV, status: "cancelled", payment: "not_required" });
    const res = await run();
    expect(app("hitha@x.com").status).toBe("cancelled");
    expect(res.body.skipped.map((s: any) => s.email)).toContain("hitha@x.com");
  });

  it("skips a deleted team, someone already accepted, and someone removed", async () => {
    team("GONE00000001", "lead3@x.com", { deletedAt: "2026-10-03T00:00:00Z" });
    invited("gone@x.com", "GONE00000001");
    invited("done@x.com", "CONFIRMED001", { acceptedAt: "2026-10-03T00:00:00Z" });
    invited("removed@x.com", "");
    const res = await run();
    expect(app("gone@x.com")).toBeUndefined();
    expect(app("done@x.com")).toBeUndefined();
    expect(app("removed@x.com")).toBeUndefined();
    expect(res.body.added.map((a: any) => a.email).sort()).toEqual(["chitra@x.com", "hitha@x.com"]);
  });

  it("is safe to run twice", async () => {
    await run();
    const second = await run();
    expect(second.body.added).toEqual([]);
  });
});
