import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Taking back a decline once the money turns up.
 *
 * Ruhan registered KIRA for Respawn on 18 Sep without a payment ID, and the
 * desk declined it the next morning. He paid that afternoon; on 22 Sep an
 * organiser verified the money against the college's sheet. But a verified
 * payment never revives a declined registration — by design — so the row sat
 * "declined, paid" for two weeks: his three teammates held tickets, and the
 * lead who paid for them had none.
 *
 * Reversing an organiser's decision is itself a decision, so it needs a
 * name. And it only applies where the money is already verified: a decline
 * that refunded money, or one with nothing verified, is a conversation, not
 * a button.
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

const EV = "respawn", RUHAN = "ruhan@example.com", BY = "org@example.com";
const REF = "JIDCWIOOPNU1QEV";

const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", {
    method: "POST", headers, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const reinstate = (over: Record<string, unknown> = {}) =>
  post({ action: "reinstate", eventId: EV, email: RUHAN, by: BY, paymentRef: REF, ...over });
const row = () => store.get(`app/${EV}/${RUHAN}.json`);
const seed = (over: Record<string, unknown> = {}) =>
  store.set(`app/${EV}/${RUHAN}.json`, {
    ticketId: "PRV-RUHAN", eventId: EV, eventName: "Respawn", status: "declined", payment: "paid",
    fee: "Rs. 200/-", name: "Ruhan", email: RUHAN, phone: "9000000000", college: "RUAS",
    teamName: "KIRA", teamCode: "N22GR3DL5NG9", members: null, paymentRef: null,
    appliedAt: "2026-09-18T15:55:21.313Z", decidedAt: "2026-09-19T02:44:47.171Z",
    refundedAt: "2026-09-19T02:44:47.171Z",
    paymentVerifiedAt: "2026-09-22T16:50:15.493Z", paymentVerifiedBy: "aryan@example.com",
    ...over,
  });

beforeEach(() => { store.clear(); mailed.length = 0; seed(); });

describe("POST /api/admin/reconcile { action: reinstate }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "reinstate", eventId: EV, email: RUHAN, by: BY }, null)).status).toBe(401);
  });

  it("refuses without naming the organiser who decided", async () => {
    const res = await reinstate({ by: "" });
    expect(res.status).toBe(400);
    expect(row().status).toBe("declined");
  });

  it("confirms a declined registration whose money is verified", async () => {
    const res = await reinstate();
    expect(res.status).toBe(200);
    expect(row().status).toBe("confirmed");
    expect(row().payment).toBe("paid");
  });

  it("records who took the decline back, and when", async () => {
    await reinstate();
    expect(row().reinstatedBy).toBe(BY);
    expect(row().reinstatedAt).toBeTruthy();
    expect(row().decidedAt).toBe(row().reinstatedAt);
  });

  /* The decline stamped a refund on money that had not arrived yet; nothing
     was ever paid back, so the stamp goes with the decline. */
  it("clears the refund the decline stamped", async () => {
    await reinstate();
    expect(row().refundedAt).toBeUndefined();
  });

  it("keeps who verified the money", async () => {
    await reinstate();
    expect(row().paymentVerifiedBy).toBe("aryan@example.com");
  });

  it("attaches the payment ID read off the sheet", async () => {
    await reinstate();
    expect(row().paymentRef).toBe(REF);
  });

  it("sends the ticket", async () => {
    const res = await reinstate();
    expect(mailed).toEqual([RUHAN]);
    expect(res.body.mailed).toBe(true);
    expect(row().confirmationEmailAt).toBeTruthy();
  });

  /* "refunded" means the money went back. Reinstating would claim a fee we
     no longer hold. */
  it("refuses when the money was refunded", async () => {
    seed({ payment: "refunded", paymentVerifiedAt: undefined, paymentVerifiedBy: undefined });
    const res = await reinstate();
    expect(res.status).toBe(409);
    expect(row().status).toBe("declined");
    expect(mailed).toEqual([]);
  });

  it("refuses a row that is not declined", async () => {
    seed({ status: "pending", payment: "awaiting" });
    expect((await reinstate()).status).toBe(409);
    expect(row().status).toBe("pending");
  });

  it("does not touch someone who withdrew themselves", async () => {
    seed({ status: "cancelled" });
    expect((await reinstate()).status).toBe(409);
    expect(row().status).toBe("cancelled");
  });

  it("says so when there is no such registration", async () => {
    expect((await reinstate({ email: "nobody@example.com" })).status).toBe(404);
  });
});
