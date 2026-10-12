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
  reminderClaimPath: (e: string, m: string, n: number) => `reminder/${e}/${m}/${n}.json`,
  /* Faithful: a write without overwrite throws on an existing key — the
     claim below depends on it. */
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
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

const EV = "electroxcape";
const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-1", eventId: EV, eventName: "ELECTROXCAPE", email, name: "A Student",
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

  /* What actually happened on the first deploy: two processes, two
     schedulers, eleven people mailed twice within a second. */
  it("two passes running at the same time send each person exactly one mail", async () => {
    for (let i = 0; i < 6; i++) row(`s${i}@example.com`);
    const res = await Promise.all([post(), post()]);
    const bodies = await Promise.all(res.map((r) => r.json()));
    expect(bodies[0].sent + bodies[1].sent).toBe(6);
    const per = new Map<string, number>();
    for (const m of sent) per.set(m.to, (per.get(m.to) ?? 0) + 1);
    expect([...per.values()].every((c) => c === 1)).toBe(true);
    expect(per.size).toBe(6);
  });

  it("a manual run right after the scheduler's sends nothing twice", async () => {
    row("owes@example.com");
    await post();
    const again = await (await post()).json();
    expect(again.sent).toBe(0);
    expect(sent).toHaveLength(1);
  });

  /* Discoverize's fee lands the moment judges shortlist a team, and this
     mail would tell them they had been to a portal they have not visited. */
  it("never chases a Discoverize team", async () => {
    store.set(`app/discoverize-research-paper-presentation/owes@example.com.json`, {
      ticketId: "PRV-D", eventId: "discoverize-research-paper-presentation",
      eventName: "Discoverize (Research Paper Presentation)", email: "owes@example.com",
      name: "A Student", status: "pending", payment: "awaiting", paymentRef: null,
      fee: "Rs. 200/-", appliedAt: "2026-09-19T09:00:00.000Z",
      round: { shortlistedAt: "2026-09-20T09:00:00.000Z" },
    });
    await post();
    expect(sent.map((m) => m.to)).not.toContain("owes@example.com");
  });

  it("dryRun reports who would get one and sends nothing", async () => {
    row("owes@example.com");
    const body = await (await post({ dryRun: true })).json();
    expect(body.due).toEqual([{ eventId: EV, email: "owes@example.com", unanswered: false }]);
    expect(sent).toHaveLength(0);
    expect(store.get(`app/${EV}/owes@example.com.json`).referenceReminderCount).toBeUndefined();
  });
});
