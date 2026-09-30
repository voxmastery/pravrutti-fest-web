import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Sending the tickets the mail server refused.
 *
 * Confirming someone and telling them are two different things, and only the
 * first is guaranteed. Hostinger throttles outbound mail, so a burst of
 * confirmations comes back "451 Ratelimit exceeded": the rows are confirmed,
 * the students hear nothing, and the only trace is confirmationEmailError on
 * a record nobody is looking at.
 *
 * This finds everyone who is confirmed with no ticket email and sends them,
 * slowly. It stops at the first throttled refusal rather than working down
 * the list stamping fresh errors on rows it never had a chance of mailing.
 */

const store = new Map<string, any>();
let outcome: (email: string) => { sent: boolean; error?: string } = () => ({ sent: true });
const attempts: string[] = [];

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
  sendConfirmationEmail: async (a: any) => { attempts.push(a.email); return outcome(a.email); },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "chaos";
const RATELIMIT = 'Message failed: 451 4.7.1 Ratelimit "hostinger_out_ratelimit" exceeded for key "RLkb"';

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
    ticketId: "PRV-" + email[0].toUpperCase(), eventId: EV, eventName: "CHAOS",
    status: "confirmed", payment: "paid", fee: "Rs. 200/-", name: email.split("@")[0],
    email, phone: "9876543210", college: "RUAS", teamName: "Bolt", teamCode: "TEAMDDDD4444",
    appliedAt: "2026-09-20T09:00:00.000Z", decidedAt: "2026-09-24T09:00:00.000Z",
    confirmationEmailAt: null, confirmationEmailError: RATELIMIT, ...over,
  });
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

beforeEach(() => {
  store.clear(); attempts.length = 0;
  outcome = () => ({ sent: true });
});

describe("POST /api/admin/reconcile { action: resend_missing }", () => {
  it("is closed without the admin key", async () => {
    row("a@x.com");
    expect((await post({ action: "resend_missing" }, null)).status).toBe(401);
    expect(attempts).toEqual([]);
  });

  it("lists who is owed a ticket and sends nothing on a dry run", async () => {
    row("a@x.com");
    row("b@x.com", { confirmationEmailAt: "2026-09-24T09:01:00.000Z", confirmationEmailError: null });
    const res = await post({ action: "resend_missing", dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.owed).toBe(1);
    expect(res.body.people[0].email).toBe("a@x.com");
    expect(res.body.people[0].lastError).toMatch(/Ratelimit/);
    expect(attempts).toEqual([]);
  });

  /* Confirmed-and-told is done, and pending has no ticket to send. Only the
     gap between the two is this action's business. */
  it("skips people who already have their ticket, and people who are not confirmed", async () => {
    row("owed@x.com");
    row("told@x.com", { confirmationEmailAt: "2026-09-24T09:01:00.000Z", confirmationEmailError: null });
    row("pending@x.com", { status: "pending", payment: "awaiting" });
    row("cancelled@x.com", { status: "cancelled" });
    await post({ action: "resend_missing", gapMs: 0 });
    expect(attempts).toEqual(["owed@x.com"]);
  });

  it("stamps the send on the record so it is not sent twice", async () => {
    row("a@x.com");
    await post({ action: "resend_missing", gapMs: 0 });
    expect(read("a@x.com").confirmationEmailAt).toBeTruthy();
    expect(read("a@x.com").confirmationEmailError).toBeNull();

    attempts.length = 0;
    const again = await post({ action: "resend_missing", gapMs: 0 });
    expect(again.body.owed).toBe(0);
    expect(attempts).toEqual([]);
  });

  /* Longest wait first: these people have been sitting on a confirmed row
     with nothing in their inbox, and the oldest has waited longest. */
  it("takes the longest-waiting first and honours the limit", async () => {
    row("new@x.com", { decidedAt: "2026-09-28T09:00:00.000Z" });
    row("old@x.com", { decidedAt: "2026-09-22T09:00:00.000Z" });
    row("mid@x.com", { decidedAt: "2026-09-25T09:00:00.000Z" });
    const res = await post({ action: "resend_missing", limit: 2, gapMs: 0 });
    expect(attempts).toEqual(["old@x.com", "mid@x.com"]);
    expect(res.body.owed).toBe(3);
    expect(res.body.sent).toBe(2);
    expect(res.body.remaining).toBe(1);
  });

  /* A throttled server refuses the next one just as fast. Carrying on would
     only stamp fresh errors on rows that never had a chance. */
  it("stops at the first throttled refusal instead of burning through the rest", async () => {
    row("a@x.com", { decidedAt: "2026-09-22T09:00:00.000Z" });
    row("b@x.com", { decidedAt: "2026-09-23T09:00:00.000Z" });
    row("c@x.com", { decidedAt: "2026-09-24T09:00:00.000Z" });
    outcome = (email) => (email === "b@x.com" ? { sent: false, error: RATELIMIT } : { sent: true });

    const res = await post({ action: "resend_missing", gapMs: 0 });
    expect(attempts).toEqual(["a@x.com", "b@x.com"]);
    expect(res.body.sent).toBe(1);
    expect(res.body.stopped).toMatch(/throttl/i);
    expect(read("c@x.com").confirmationEmailAt).toBeNull();
  });

  /* A refusal that is not the throttle says something about that one address,
     not about the queue behind it. */
  it("keeps going past a refusal that is not the throttle", async () => {
    row("a@x.com", { decidedAt: "2026-09-22T09:00:00.000Z" });
    row("b@x.com", { decidedAt: "2026-09-23T09:00:00.000Z" });
    outcome = (email) => (email === "a@x.com" ? { sent: false, error: "550 no such mailbox" } : { sent: true });

    const res = await post({ action: "resend_missing", gapMs: 0 });
    expect(attempts).toEqual(["a@x.com", "b@x.com"]);
    expect(res.body.sent).toBe(1);
    expect(res.body.stopped).toBeNull();
  });
});
