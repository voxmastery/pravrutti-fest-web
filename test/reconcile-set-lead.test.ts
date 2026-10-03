import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Changing who leads — and pays for — a team.
 *
 * Wonderfools' lead went to the payment portal on 26 Sep and never paid,
 * and the team asked for Darshan to take over and pay instead. The lead is
 * whoever the team record names, and the lead's own registration is the
 * charged one; so changing the lead moves both: the new lead's registration
 * becomes the one that owes the fee, set up to go and pay, and the old
 * lead's becomes an ordinary teammate's, covered by the new lead.
 *
 * It refuses to move money. If the current lead has paid, quoted a payment
 * ID, or been confirmed, the fee is recorded against them, and handing the
 * team to someone else would leave that payment attached to a teammate —
 * that is a refund conversation, not a button.
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

const EV = "chaos", CODE = "8G34EFGLHD2P";
const OLD = "chandana@example.com", NEW = "darshan@example.com", OTHER = "stranger@example.com";
const BY = "org@example.com";

const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", {
    method: "POST", headers, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const setLead = (over: Record<string, unknown> = {}) =>
  post({ action: "set_lead", eventId: EV, code: CODE, email: NEW, by: BY, ...over });

const app = (email: string) => store.get(`app/${EV}/${email}.json`);
const team = () => store.get(`team/${EV}/${CODE}.json`);

beforeEach(() => {
  store.clear();
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Wonderfools", bio: "", createdByEmail: OLD, members: [],
    createdAt: "2026-09-26T12:19:00.000Z",
  });
  store.set(`app/${EV}/${OLD}.json`, {
    ticketId: "PRV-OLD", eventId: EV, eventName: "CHAOS", status: "pending", payment: "awaiting",
    fee: "Rs. 200/-", name: "Chandana N", email: OLD, phone: "8296708069", college: "SNPSU",
    teamName: "Wonderfools", teamCode: CODE, members: null, paymentRef: null, stage: "intent",
    appliedAt: "2026-09-26T12:19:00.000Z",
  });
  store.set(`app/${EV}/${NEW}.json`, {
    ticketId: "PRV-NEW", eventId: EV, eventName: "CHAOS", status: "pending", payment: "not_required",
    fee: "Covered by team lead", name: "Darshan S", email: NEW, phone: "9482501769", college: "SNPSU",
    teamName: "Wonderfools", teamCode: CODE, members: null, appliedAt: "2026-10-02T09:33:00.000Z",
  });
});

describe("POST /api/admin/reconcile { action: set_lead }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "set_lead", eventId: EV, code: CODE, email: NEW, by: BY }, null)).status).toBe(401);
  });

  it("refuses without naming the organiser who decided", async () => {
    const res = await setLead({ by: undefined });
    expect(res.status).toBe(400);
    expect(team().createdByEmail).toBe(OLD);
  });

  it("makes the new person the team's lead", async () => {
    const res = await setLead();
    expect(res.status).toBe(200);
    expect(team().createdByEmail).toBe(NEW);
  });

  /* They are about to pay, so they get the "did your payment go through? /
     reopen the portal" step that a lead who has not paid sees. */
  it("puts the fee on the new lead, ready to go and pay", async () => {
    await setLead();
    expect(app(NEW).payment).toBe("awaiting");
    expect(app(NEW).fee).toBe("Rs. 200/-");
    expect(app(NEW).stage).toBe("intent");
    expect(app(NEW).paymentRef ?? null).toBeNull();
  });

  it("makes the old lead an ordinary teammate", async () => {
    await setLead();
    expect(app(OLD).payment).toBe("not_required");
    expect(app(OLD).fee).toBe("Covered by team lead");
    expect(app(OLD).stage).toBeUndefined();
    expect(app(OLD).status).toBe("pending");
  });

  /* Tickets they may already have saved keep working. */
  it("keeps everyone's ticket ID", async () => {
    await setLead();
    expect(app(NEW).ticketId).toBe("PRV-NEW");
    expect(app(OLD).ticketId).toBe("PRV-OLD");
  });

  it("records who changed it and when", async () => {
    await setLead();
    expect(team().leadChangedBy).toBe(BY);
    expect(team().previousLead).toBe(OLD);
    expect(team().leadChangedAt).toBeTruthy();
  });

  it("refuses someone with no registration on the team", async () => {
    const res = await setLead({ email: OTHER });
    expect(res.status).toBe(409);
    expect(team().createdByEmail).toBe(OLD);
  });

  it("refuses someone whose registration is on a different team", async () => {
    store.set(`app/${EV}/${NEW}.json`, { ...app(NEW), teamCode: "OTHERTEAM001" });
    expect((await setLead()).status).toBe(409);
    expect(team().createdByEmail).toBe(OLD);
  });

  it("refuses someone who withdrew", async () => {
    store.set(`app/${EV}/${NEW}.json`, { ...app(NEW), status: "cancelled" });
    expect((await setLead()).status).toBe(409);
  });

  it("does nothing when they already lead the team", async () => {
    expect((await setLead({ email: OLD })).status).toBe(409);
  });

  it("says so when there is no such team", async () => {
    expect((await setLead({ code: "NOSUCHTEAM01" })).status).toBe(404);
  });

  /* The guard: money recorded against the current lead stays with them. */
  it("refuses when the current lead has paid", async () => {
    store.set(`app/${EV}/${OLD}.json`, { ...app(OLD), payment: "paid", stage: undefined });
    const res = await setLead();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/paid|payment/i);
    expect(team().createdByEmail).toBe(OLD);
    expect(app(NEW).payment).toBe("not_required");
  });

  it("refuses when the current lead has quoted a payment ID", async () => {
    store.set(`app/${EV}/${OLD}.json`, { ...app(OLD), paymentRef: "J5N3Z8Y0MUQG1UY" });
    expect((await setLead()).status).toBe(409);
    expect(team().createdByEmail).toBe(OLD);
  });

  it("refuses when the current lead is confirmed", async () => {
    store.set(`app/${EV}/${OLD}.json`, { ...app(OLD), status: "confirmed" });
    expect((await setLead()).status).toBe(409);
  });

  /* A lead who never registered owes nothing and holds nothing: the team
     can still be handed over. */
  it("hands over a team whose lead never registered", async () => {
    store.delete(`app/${EV}/${OLD}.json`);
    expect((await setLead()).status).toBe(200);
    expect(team().createdByEmail).toBe(NEW);
    expect(app(NEW).payment).toBe("awaiting");
  });
});
