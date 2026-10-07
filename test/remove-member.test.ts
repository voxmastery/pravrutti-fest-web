import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * An organiser taking one person off a team.
 *
 * The lead can already remove a teammate while signed in. Prital on Puzzlers
 * needed the same effect when the request came to the organisers: cancel the
 * ticket, drop the roster place, and kill the invite link — without being
 * the lead, and without taking the lead or the team's payment with them.
 */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k, pathname: k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([k, v]) => k.startsWith(`team-member/${eventId}/`) && v?.code === code && v?.member)
      .map(([, v]) => v.member),
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
}));

let removeTeammate: typeof import("@/lib/remove-member").removeTeammate;
let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ removeTeammate } = await import("@/lib/remove-member"));
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "the-logic-circuit";
const CODE = "PUZZLERS0001";
const LEAD = "paulinejoseph9a5@gmail.com";
const MATE = "25etcs002232@msruas.ac.in";
const TOKEN = "cd".repeat(32);

const seed = () => {
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Puzzlers", bio: "", createdByEmail: LEAD, members: [], createdAt: "2026-10-01T00:00:00.000Z",
  });
  store.set(`team-member/${EV}/${LEAD}.json`, {
    code: CODE, eventId: EV,
    member: { name: "Pauline Joseph", email: LEAD, phone: "9778227276", college: "RUAS", joinedAt: "2026-10-01T00:00:00.000Z" },
  });
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "The Logic Circuit", status: "confirmed", payment: "paid",
    fee: "Rs. 200/-", name: "Pauline Joseph", email: LEAD, phone: "9778227276", college: "RUAS",
    teamName: "Puzzlers", teamCode: CODE, appliedAt: "2026-10-01T00:00:00.000Z",
  });
  store.set(`team-member/${EV}/${MATE}.json`, {
    code: CODE, eventId: EV,
    member: {
      name: "Prital H", email: MATE, phone: "9000000000", college: "RUAS",
      joinedAt: "2026-10-02T00:00:00.000Z", inviteToken: TOKEN,
    },
  });
  store.set(`invite/${TOKEN}.json`, { token: TOKEN, eventId: EV, code: CODE, email: MATE });
  store.set(`app/${EV}/${MATE}.json`, {
    ticketId: "PRV-MATE", eventId: EV, eventName: "The Logic Circuit", status: "confirmed", payment: "not_required",
    fee: "Covered by team lead", name: "Prital H", email: MATE, phone: "9000000000", college: "RUAS",
    teamName: "Puzzlers", teamCode: CODE, appliedAt: "2026-10-02T00:00:00.000Z",
  });
};

beforeEach(() => {
  store.clear();
  seed();
});

describe("removeTeammate", () => {
  it("cancels the ticket, drops the roster place, and burns the invite", async () => {
    const result = await removeTeammate({ eventId: EV, email: MATE, removedBy: "aryan@pravrutti.test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyGone).toBe(false);
    expect(result.teamName).toBe("Puzzlers");
    expect(store.get(`app/${EV}/${MATE}.json`).status).toBe("cancelled");
    expect(store.get(`team-member/${EV}/${MATE}.json`).code).toBe("");
    expect(store.get(`team-member/${EV}/${MATE}.json`).removedBy).toBe("aryan@pravrutti.test");
    expect(store.get(`invite/${TOKEN}.json`).usedAt).toBeTruthy();
    expect(store.get(`app/${EV}/${LEAD}.json`).status).toBe("confirmed");
  });

  it("is safe to run again", async () => {
    await removeTeammate({ eventId: EV, email: MATE, removedBy: "aryan@pravrutti.test" });
    const again = await removeTeammate({ eventId: EV, email: MATE, removedBy: "aryan@pravrutti.test", code: CODE });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.alreadyGone).toBe(true);
  });

  it("refuses the current lead", async () => {
    const result = await removeTeammate({ eventId: EV, email: LEAD, removedBy: "aryan@pravrutti.test" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(store.get(`app/${EV}/${LEAD}.json`).status).toBe("confirmed");
  });

  it("refuses while an unverified payment is what holds the team", async () => {
    store.set(`team/${EV}/${CODE}.json`, {
      code: CODE, eventId: EV, name: "Puzzlers", bio: "", createdByEmail: "newlead@x.com", members: [], createdAt: "2026-10-01T00:00:00.000Z",
    });
    store.set(`app/${EV}/${MATE}.json`, {
      ...store.get(`app/${EV}/${MATE}.json`),
      status: "pending", payment: "awaiting", fee: "Rs. 200/-", paymentRef: "JUNO123456789",
    });
    const result = await removeTeammate({ eventId: EV, email: MATE, removedBy: "aryan@pravrutti.test" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/payment/i);
    expect(store.get(`app/${EV}/${MATE}.json`).status).toBe("pending");
  });

  it("says when they are not on the team", async () => {
    const result = await removeTeammate({ eventId: EV, email: "nobody@x.com", removedBy: "aryan@pravrutti.test", code: CODE });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("POST /api/admin/reconcile { action: remove_member }", () => {
  const post = async (body: unknown, key: string | null = "test-admin-key") => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (key) headers["x-admin-key"] = key;
    const res = await POST(new Request("http://t/api/admin/reconcile", {
      method: "POST", headers, body: JSON.stringify(body),
    }));
    return { status: res.status, body: await res.json() };
  };

  it("is closed without the admin key", async () => {
    expect((await post({ action: "remove_member", eventId: EV, email: MATE, by: "org@example.com" }, null)).status).toBe(401);
  });

  it("names the organiser and cancels the teammate", async () => {
    const res = await post({ action: "remove_member", eventId: EV, email: MATE, by: "org@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, alreadyGone: false, status: "cancelled", teamName: "Puzzlers", by: "org@example.com" });
    expect(store.get(`team-member/${EV}/${MATE}.json`).removedBy).toBe("org@example.com");
  });

  it("refuses without naming who decided", async () => {
    expect((await post({ action: "remove_member", eventId: EV, email: MATE, by: "" })).status).toBe(400);
  });
});
