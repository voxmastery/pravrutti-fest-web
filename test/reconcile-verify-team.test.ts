import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Confirming a team through the admin key.
 *
 * The desk confirms teams from a signed-in session, and that is the right
 * default: `paymentVerifiedBy` exists because a decision about money needs a
 * name against it, and a shared key gives none. But the payment report keys
 * on email, and a student who pays from their college address and registers
 * from Gmail is invisible to it — no button on the desk can find them.
 *
 * So the key may do it, on one condition: the caller states which organiser
 * decided. An unnamed confirmation is refused rather than written, which
 * keeps the guarantee the session gave for free.
 */

const store = new Map<string, any>();
const mailed: string[] = [];

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
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "line-follower", CODE = "TEAMDDDD4444";
const LEAD = "lead@example.com", MATE = "mate@example.com";

const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", {
    method: "POST", headers, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

const row = (email: string, over: Record<string, unknown> = {}) =>
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-" + email[0].toUpperCase(), eventId: EV, eventName: "LINE FOLLOWER",
    status: "pending", payment: "awaiting", fee: "Rs. 200/-", name: email.split("@")[0],
    email, phone: "9876543210", college: "RUAS", teamName: "Bolt", teamCode: CODE,
    paymentRef: null, appliedAt: "2026-09-16T09:00:00.000Z", ...over,
  });
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

beforeEach(() => {
  store.clear(); mailed.length = 0;
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", createdByEmail: LEAD, members: [],
    createdAt: "2026-09-16T09:00:00.000Z",
  });
});

describe("POST /api/admin/reconcile { action: verify_team }", () => {
  it("is closed without the admin key", async () => {
    row(LEAD);
    expect((await post({ action: "verify_team", eventId: EV, code: CODE, by: "org@x.com" }, null)).status).toBe(401);
    expect(read(LEAD).status).toBe("pending");
  });

  /* The whole point of the guard: the key identifies nobody, so the caller
     must say who decided. */
  it("refuses to confirm without naming the organiser", async () => {
    row(LEAD);
    const res = await post({ action: "verify_team", eventId: EV, code: CODE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/who/i);
    expect(read(LEAD).status).toBe("pending");
  });

  it("refuses a name that is not an email address", async () => {
    row(LEAD);
    expect((await post({ action: "verify_team", eventId: EV, code: CODE, by: "ganesh" })).status).toBe(400);
    expect(read(LEAD).status).toBe("pending");
  });

  it("confirms the whole team and emails every member", async () => {
    row(LEAD);
    row(MATE, { payment: "not_required", fee: "Covered by team lead" });
    const res = await post({
      action: "verify_team", eventId: EV, code: CODE,
      by: "org@example.com", paymentRef: "J5N3Z8Y0MUQG1UY",
    });
    expect(res.status).toBe(200);
    expect(read(LEAD).status).toBe("confirmed");
    expect(read(MATE).status).toBe("confirmed");
    expect(mailed.sort()).toEqual([LEAD, MATE].sort());
  });

  it("puts the named organiser against the money, not the key", async () => {
    row(LEAD);
    await post({ action: "verify_team", eventId: EV, code: CODE, by: "org@example.com", paymentRef: "REF123456" });
    expect(read(LEAD).paymentVerifiedBy).toBe("org@example.com");
    expect(read(LEAD).payment).toBe("paid");
    expect(read(LEAD).paymentRef).toBe("REF123456");
  });

  /* The fee is one payment for the team. Four "paid" stamps would put Rs. 800
     in the books where Rs. 200 was taken. */
  it("records the money against the payer alone", async () => {
    row(LEAD);
    row(MATE, { payment: "not_required", fee: "Covered by team lead" });
    await post({ action: "verify_team", eventId: EV, code: CODE, by: "org@example.com", paymentRef: "REF123456" });
    expect(read(MATE).payment).toBe("not_required");
    expect(read(MATE).paymentRef ?? null).toBeNull();
  });

  it("keeps a reference the student gave us when none is supplied", async () => {
    row(LEAD, { paymentRef: "GQDT-13NASUMZDM7" });
    await post({ action: "verify_team", eventId: EV, code: CODE, by: "org@example.com" });
    expect(read(LEAD).paymentRef).toBe("GQDT-13NASUMZDM7");
    expect(read(LEAD).status).toBe("confirmed");
  });

  it("says so when the team has nobody live on it", async () => {
    const res = await post({ action: "verify_team", eventId: EV, code: "NOSUCHCODE01", by: "org@example.com" });
    expect(res.status).toBe(404);
  });
});
