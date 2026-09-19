import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Payment happens on the college's portal, in a tab we get no callback from,
   so a registration written only when someone returns is lost to anything that
   interrupts them. These cover the row written before they leave, and the one
   written for somebody who paid and cannot produce a reference. */

const store = new Map<string, any>();
const sent: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  /* Faithful to the real store: a write that would overwrite without
     permission throws, which is what the duplicate guard relies on. */
  putJson: async (p: string, data: unknown, allowOverwrite?: boolean) => {
    if (store.has(p) && !allowOverwrite) throw new Error("exists");
    store.set(p, data);
  },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/received-email", () => ({
  sendReceivedEmail: async (record: any) => { sent.push(record); return { sent: true }; },
}));

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
  ...over,
});
const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => { store.clear(); sent.length = 0; });

describe("POST /api/register — the row written before they leave to pay", () => {
  it("records someone with no reference at all", async () => {
    const res = await post(base({ stage: "intent" }));
    expect(res.status).toBe(200);
    const saved = store.get(KEY);
    expect(saved.payment).toBe("awaiting");
    expect(saved.paymentRef).toBeNull();
    expect(saved.status).toBe("pending");
  });

  /* Mail here would read as confirmation of a payment that has not happened. */
  it("sends no acknowledgement", async () => {
    await post(base({ stage: "intent" }));
    expect(sent).toHaveLength(0);
  });

  /* The reference is the thing they come back with; junk is still junk. */
  it("still refuses a reference that could not be a receipt", async () => {
    expect((await post(base({ stage: "intent", paymentRef: "asdfgh" }))).status).toBe(400);
  });

  it("does not become a second place when they come back and finish", async () => {
    await post(base({ stage: "intent" }));
    const first = store.get(KEY);

    const res = await post(base({ paymentRef: "JUNO-2026-0091" }));
    expect(res.status).toBe(200);

    const saved = store.get(KEY);
    expect(saved.paymentRef).toBe("JUNO-2026-0091");
    /* Same ticket and same time: nothing they have already been shown moves. */
    expect(saved.ticketId).toBe(first.ticketId);
    expect(saved.appliedAt).toBe(first.appliedAt);
    expect(sent).toHaveLength(1);
  });

  /* Without this the duplicate guard, which is what stops one person taking
     two places, would also stop them finishing their own registration. */
  it("leaves the guard against a genuine duplicate intact", async () => {
    await post(base({ paymentRef: "JUNO-2026-0091" }));
    const res = await post(base({ paymentRef: "JUNO-2026-0092" }));
    expect(res.status).toBe(409);
    expect(store.get(KEY).paymentRef).toBe("JUNO-2026-0091");
  });
});

describe("POST /api/register — paid but cannot produce the reference", () => {
  /* Refusing them does not bring the money back; it only hides them from the
     desk. The row is saved so an organiser can match it to the sheet. */
  it("accepts the registration and records it as unverified", async () => {
    const res = await post(base({ refUnavailable: true }));
    expect(res.status).toBe(200);
    const saved = store.get(KEY);
    expect(saved.payment).toBe("awaiting");
    expect(saved.paymentRef).toBeNull();
  });

  it("acknowledges it, because this one is a real submission", async () => {
    await post(base({ refUnavailable: true }));
    expect(sent).toHaveLength(1);
  });

  /* The claim is about not having a reference, not about having a bad one. */
  it("still refuses junk offered alongside the claim", async () => {
    expect((await post(base({ refUnavailable: true, paymentRef: "aaaaaa" }))).status).toBe(400);
  });
});
