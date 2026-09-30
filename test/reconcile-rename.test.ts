import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Correcting the name somebody registered under.
 *
 * Students put jokes in the name field — "truth falcinator" for Shivansh
 * Sinha — and then want their own name back, because it is the name on the
 * ticket, on the desk list and on whatever gets checked at the door.
 *
 * The name lives in two places: their application, which the ticket and the
 * desk read, and their team-member record, which the team roster reads.
 * Fixing one leaves the other showing the joke, so this does both. Nothing
 * else about the registration moves — not the status, not the money, not
 * the ticket ID they may already be holding a screenshot of.
 */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "chaos", CODE = "HG6V7QB2ZPZS", WHO = "shivansh@example.com";

const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", {
    method: "POST", headers, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

const appRow = () => store.get(`app/${EV}/${WHO}.json`);
const memberRow = () => store.get(`team-member/${EV}/${WHO}.json`);

beforeEach(() => {
  store.clear();
  store.set(`app/${EV}/${WHO}.json`, {
    ticketId: "PRV-56FEDE268E1860DB", eventId: EV, eventName: "CHAOS",
    status: "confirmed", payment: "paid", fee: "Rs. 200/-",
    name: "truth falcinator", email: WHO, phone: "9760535642",
    college: "Dayananda Sagar College of Engineering",
    teamName: ".dll not found", teamCode: CODE,
    appliedAt: "2026-09-27T06:58:51.000Z", decidedAt: "2026-09-28T06:00:00.000Z",
    paymentRef: "SOMEREF123", paymentVerifiedBy: "org@example.com",
  });
  store.set(`team-member/${EV}/${WHO}.json`, {
    code: CODE, eventId: EV,
    member: { name: "truth falcinator", email: WHO, phone: "9760535642",
              college: "Dayananda Sagar College of Engineering",
              joinedAt: "2026-09-27T06:58:51.000Z" },
  });
});

describe("POST /api/admin/reconcile { action: rename }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "rename", eventId: EV, email: WHO, name: "Shivansh Sinha" }, null)).status).toBe(401);
    expect(appRow().name).toBe("truth falcinator");
  });

  it("puts the real name on the ticket and on the team roster", async () => {
    const res = await post({ action: "rename", eventId: EV, email: WHO, name: "Shivansh Sinha" });
    expect(res.status).toBe(200);
    expect(res.body.was).toBe("truth falcinator");
    expect(appRow().name).toBe("Shivansh Sinha");
    expect(memberRow().member.name).toBe("Shivansh Sinha");
  });

  /* They may already be holding a screenshot of the ticket, and the money
     and the decision are nobody's business here. */
  it("changes nothing else about the registration", async () => {
    const before = { ...appRow() };
    await post({ action: "rename", eventId: EV, email: WHO, name: "Shivansh Sinha" });
    const after = appRow();
    for (const k of ["ticketId", "status", "payment", "paymentRef", "paymentVerifiedBy",
                     "decidedAt", "appliedAt", "teamCode", "teamName", "phone", "college", "email"])
      expect([k, after[k]]).toEqual([k, before[k]]);
  });

  it("trims what it is given", async () => {
    await post({ action: "rename", eventId: EV, email: WHO, name: "  Shivansh Sinha  " });
    expect(appRow().name).toBe("Shivansh Sinha");
  });

  it("refuses a name that is not one", async () => {
    for (const bad of ["", " ", "x", "y".repeat(81)]) {
      const res = await post({ action: "rename", eventId: EV, email: WHO, name: bad });
      expect(res.status).toBe(400);
    }
    expect(appRow().name).toBe("truth falcinator");
  });

  it("says so when there is no such registration", async () => {
    const res = await post({ action: "rename", eventId: EV, email: "nobody@example.com", name: "Someone Real" });
    expect(res.status).toBe(404);
  });

  /* A solo entrant has no team-member record; renaming them must still work. */
  it("renames someone who is not on a team", async () => {
    store.delete(`team-member/${EV}/${WHO}.json`);
    const res = await post({ action: "rename", eventId: EV, email: WHO, name: "Shivansh Sinha" });
    expect(res.status).toBe(200);
    expect(appRow().name).toBe("Shivansh Sinha");
    expect(res.body.roster).toBe(false);
  });
});
