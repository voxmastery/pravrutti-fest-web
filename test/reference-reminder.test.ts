import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Somebody registered, paid on the college portal, and never came back with
   the Transaction Reference No — or never said how the payment went at all.
   These reminders carry a one-tap link to the exact screen that takes it. */

const store = new Map<string, any>();
const sent: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/mailer", () => ({
  siteOrigin: () => "https://pravrutti.tech",
  sendMail: async (m: any) => { sent.push(m); return { sent: true }; },
}));

let POST: typeof import("@/app/api/admin/reference-reminders/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "k";
  ({ POST } = await import("@/app/api/admin/reference-reminders/route"));
});

const EV = "the-logic-circuit";
const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-1", eventId: EV, eventName: "The Logic Circuit", email, name: "A Student",
    status: "pending", payment: "awaiting", paymentRef: null, fee: "Rs. 200/-",
    appliedAt: "2026-09-19T09:00:00.000Z", ...over,
  });
};
const post = (body: Record<string, unknown> = {}, key = "k") =>
  POST(new Request("http://t/api/admin/reference-reminders", {
    method: "POST", headers: { "x-admin-key": key }, body: JSON.stringify(body),
  }));

beforeEach(() => { store.clear(); sent.length = 0; });

describe("POST /api/admin/reference-reminders", () => {
  it("refuses without the admin key", async () => {
    expect((await post({}, "wrong")).status).toBe(401);
  });

  it("reminds only the people pending on a payment with no reference", async () => {
    row("owes@example.com");
    row("has-ref@example.com", { paymentRef: "JIDCWIOOPNU1QEV" });
    row("paid@example.com", { payment: "paid" });
    row("confirmed@example.com", { status: "confirmed" });
    row("cancelled@example.com", { status: "cancelled" });
    row("teammate@example.com", { payment: "not_required" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(sent.map((m) => m.to)).toEqual(["owes@example.com"]);
  });

  it("links straight to the screen that takes the reference, with the receipt example inline", async () => {
    row("owes@example.com");
    await post();
    const m = sent[0];
    expect(m.html).toContain(`https://pravrutti.tech/events/${EV}?finish=reference`);
    expect(m.text).toContain(`https://pravrutti.tech/events/${EV}?finish=reference`);
    expect(m.html).toContain("Transaction Reference No");
    expect(m.html).toContain("cid:juno-receipt");
    expect(m.attachments?.[0]?.cid).toBe("juno-receipt");
  });

  /* One mail for both the person who never came back and the one who came
     back without the reference: the screen it lands on handles either. */
  it("sends the same one-button mail whether or not they ever answered", async () => {
    row("silent@example.com", { stage: "intent" });
    row("answered@example.com");
    await post();
    const subjects = new Set(sent.map((m) => m.subject));
    expect(subjects.size).toBe(1);
    expect([...subjects][0]).toMatch(/Confirm your registration/i);
    expect(sent[0].html).toContain("Confirm my registration");
    expect(sent[0].html).toContain("Transaction Reference No");
    expect(sent[0].html).not.toMatch(/tell us how it went/i);
  });

  it("stamps the row so the next run knows", async () => {
    row("owes@example.com");
    await post();
    const saved = store.get(`app/${EV}/owes@example.com.json`);
    expect(saved.referenceReminderCount).toBe(1);
    expect(typeof saved.referenceReminderAt).toBe("string");
  });

  it("does not nag: skips anyone reminded in the last 20 hours, and stops after three", async () => {
    row("recent@example.com", { referenceReminderAt: new Date(Date.now() - 2 * 3600e3).toISOString(), referenceReminderCount: 1 });
    row("due@example.com", { referenceReminderAt: new Date(Date.now() - 30 * 3600e3).toISOString(), referenceReminderCount: 1 });
    row("done@example.com", { referenceReminderAt: new Date(Date.now() - 30 * 3600e3).toISOString(), referenceReminderCount: 3 });
    const res = await post();
    const body = await res.json();
    expect(sent.map((m) => m.to)).toEqual(["due@example.com"]);
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(2);
  });

  it("dryRun reports who would get one and sends nothing", async () => {
    row("owes@example.com");
    const body = await (await post({ dryRun: true })).json();
    expect(body.due).toEqual([{ eventId: EV, email: "owes@example.com", unanswered: false }]);
    expect(sent).toHaveLength(0);
    expect(store.get(`app/${EV}/owes@example.com.json`).referenceReminderCount).toBeUndefined();
  });
});
