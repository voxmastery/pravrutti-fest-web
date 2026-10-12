import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Submitting sends an acknowledgement, because somebody has just paid ₹200 on a
   third-party portal and silence reads like the money went nowhere. The rule
   that matters: a mail outage must never cost them their place. */

const store = new Map<string, any>();
const mail = vi.hoisted(() => ({
  calls: [] as any[],
  result: { sent: true } as { sent: boolean; error?: string; skipped?: boolean },
}));

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
vi.mock("@/lib/received-email", () => ({
  sendReceivedEmail: async (a: unknown) => {
    mail.calls.push(a);
    return mail.result;
  },
}));
vi.mock("@/lib/pravrutti-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    registrationOpen: () => true,
    effectiveRegistrationOpen: () => true,
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "the-logic-circuit" ? { ...e, full: false } : e,
    ),
  };
});

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/register/route"));
});

const EVENT = "the-logic-circuit";
const KEY = `app/${EVENT}/asha@example.com.json`;
const base = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  eventId: EVENT,
  paymentRef: "JUNO-2026-0091",
  ...over,
});
const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  store.clear();
  mail.calls.length = 0;
  mail.result = { sent: true };
});

describe("POST /api/register — acknowledgement email", () => {
  it("emails the applicant once, with their own record", async () => {
    expect((await post(base())).status).toBe(200);
    expect(mail.calls).toHaveLength(1);
    expect(mail.calls[0]).toMatchObject({ email: "asha@example.com", eventName: "The Logic Circuit" });
  });

  it("stamps when it went out", async () => {
    await post(base());
    expect(store.get(KEY).receivedEmailAt).toBeTruthy();
    expect(store.get(KEY).receivedEmailError).toBeNull();
  });

  /* The whole point: mail is best-effort, the place is not. */
  it("still registers them when the mail fails", async () => {
    mail.result = { sent: false, error: "SMTP refused" };
    const res = await post(base());
    expect(res.status).toBe(200);
    expect(store.get(KEY).status).toBe("pending");
    expect(store.get(KEY).receivedEmailError).toBe("SMTP refused");
    expect(store.get(KEY).receivedEmailAt).toBeUndefined();
  });

  it("still registers them when mail is not configured at all", async () => {
    mail.result = { sent: false, skipped: true, error: "Mail is not configured." };
    expect((await post(base())).status).toBe(200);
    expect(store.get(KEY).status).toBe("pending");
  });
});
