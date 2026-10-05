import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Correcting the payment ID on a registration.
 *
 * Skanda K N paid four times for his four events, but Respawn and Bracket
 * Blitz were both verified against the same payment, RYZUOM8YAXMMVIM, and
 * his fourth payment, 2S8X6QYHYHO3MBR, sat attached to nothing. The money
 * was all there; the books said one payment covered two places.
 *
 * Correcting it is a decision about money, so it names the organiser who
 * made it, and it will not attach a payment that already pays for
 * somebody else's place.
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
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const SKANDA = "skanda@example.com", BY = "org@example.com";
const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const setRef = (over: Record<string, unknown> = {}) =>
  post({ action: "set_payment_ref", eventId: "bracket-blitz", email: SKANDA, paymentRef: "2S8X6QYHYHO3MBR", by: BY, ...over });
const row = (ev: string) => store.get(`app/${ev}/${SKANDA}.json`);
const paid = (ev: string, ref: string) =>
  store.set(`app/${ev}/${SKANDA}.json`, {
    ticketId: "PRV-" + ev, eventId: ev, eventName: ev, status: "confirmed", payment: "paid", fee: "Rs. 200/-",
    name: "Skanda K N", email: SKANDA, phone: "9000000000", college: "RUAS", teamName: "Crisp Coders",
    teamCode: null, members: null, appliedAt: "2026-09-19T08:27:19.687Z", paymentRef: ref,
    paymentVerifiedBy: "aryan@example.com", paymentVerifiedAt: "2026-09-25T13:01:45.932Z",
  });

beforeEach(() => {
  store.clear();
  paid("respawn", "RYZUOM8YAXMMVIM");
  paid("bracket-blitz", "RYZUOM8YAXMMVIM");
});

describe("POST /api/admin/reconcile { action: set_payment_ref }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "set_payment_ref", eventId: "bracket-blitz", email: SKANDA, paymentRef: "X", by: BY }, null)).status).toBe(401);
  });

  it("refuses without naming the organiser who decided", async () => {
    expect((await setRef({ by: "" })).status).toBe(400);
    expect(row("bracket-blitz").paymentRef).toBe("RYZUOM8YAXMMVIM");
  });

  it("refuses an empty payment ID", async () => {
    expect((await setRef({ paymentRef: "  " })).status).toBe(400);
  });

  it("puts the right payment against the registration", async () => {
    const res = await setRef();
    expect(res.status).toBe(200);
    expect(row("bracket-blitz").paymentRef).toBe("2S8X6QYHYHO3MBR");
    expect(row("respawn").paymentRef).toBe("RYZUOM8YAXMMVIM");
  });

  it("records who corrected it, and keeps who verified the money", async () => {
    await setRef();
    expect(row("bracket-blitz").paymentRefSetBy).toBe(BY);
    expect(row("bracket-blitz").paymentRefSetAt).toBeTruthy();
    expect(row("bracket-blitz").paymentVerifiedBy).toBe("aryan@example.com");
  });

  it("will not attach a payment that already pays for another place", async () => {
    const res = await setRef({ eventId: "respawn", paymentRef: "ryzuom8yaxmmvim" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/bracket-blitz/);
  });

  it("says so when there is no such registration", async () => {
    expect((await setRef({ email: "nobody@example.com" })).status).toBe(404);
  });
});
