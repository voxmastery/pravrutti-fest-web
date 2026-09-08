import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "boss@pravrutti.test" }));

let POST: typeof import("@/app/api/dashboard/payment/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/dashboard/payment/route"));
});

const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t", { method: "POST", body: JSON.stringify(b) }));

const KEY = "app/robo-race/asha@example.com.json";

beforeEach(() => {
  store.clear();
  role.current = { kind: "organiser" };
  store.set(KEY, {
    ticketId: "PRV-1", eventId: "robo-race", eventName: "Robo Race",
    status: "pending", payment: "awaiting",
    name: "Asha", email: "asha@example.com", appliedAt: "2026-09-01T00:00:00.000Z",
  });
});

describe("POST /api/dashboard/payment", () => {
  it("marks paid and confirms a pending application in one action", async () => {
    const res = await post({ eventId: "robo-race", email: "asha@example.com" });
    expect(res.status).toBe(200);
    const rec = store.get(KEY);
    expect(rec.payment).toBe("paid");
    expect(rec.status).toBe("confirmed");
  });

  it("records who verified it and when", async () => {
    await post({ eventId: "robo-race", email: "asha@example.com" });
    const rec = store.get(KEY);
    expect(rec.paymentVerifiedBy).toBe("boss@pravrutti.test");
    expect(Date.parse(rec.paymentVerifiedAt)).not.toBeNaN();
  });

  it("undoes cleanly, returning them to the queue", async () => {
    await post({ eventId: "robo-race", email: "asha@example.com" });
    await post({ eventId: "robo-race", email: "asha@example.com", verified: false });
    const rec = store.get(KEY);
    expect(rec.payment).toBe("awaiting");
    expect(rec.status).toBe("pending");
    expect(rec.paymentVerifiedBy).toBeUndefined();
  });

  it("never revives a declined application", async () => {
    store.get(KEY).status = "declined";
    await post({ eventId: "robo-race", email: "asha@example.com" });
    expect(store.get(KEY).status).toBe("declined");
    expect(store.get(KEY).payment).toBe("paid");
  });

  it("never un-declines on undo either", async () => {
    store.get(KEY).status = "declined";
    await post({ eventId: "robo-race", email: "asha@example.com", verified: false });
    expect(store.get(KEY).status).toBe("declined");
  });

  it("refuses a coordinator — their own event's money is a conflict", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race"] };
    const res = await post({ eventId: "robo-race", email: "asha@example.com" });
    expect(res.status).toBe(403);
    expect(store.get(KEY).payment).toBe("awaiting");
  });

  it("refuses someone with no role", async () => {
    role.current = { kind: "none" };
    expect((await post({ eventId: "robo-race", email: "asha@example.com" })).status).toBe(403);
  });

  it("404s an applicant that doesn't exist rather than creating one", async () => {
    const res = await post({ eventId: "robo-race", email: "ghost@example.com" });
    expect(res.status).toBe(404);
    expect(store.size).toBe(1);
  });

  it("is idempotent — verifying twice leaves one consistent record", async () => {
    await post({ eventId: "robo-race", email: "asha@example.com" });
    const first = store.get(KEY).paymentVerifiedAt;
    await post({ eventId: "robo-race", email: "asha@example.com" });
    const rec = store.get(KEY);
    expect(rec.payment).toBe("paid");
    expect(rec.status).toBe("confirmed");
    expect(Date.parse(rec.paymentVerifiedAt)).toBeGreaterThanOrEqual(Date.parse(first));
  });

  it("approves a joiner without rewriting not_required into paid", async () => {
    store.get(KEY).payment = "not_required";
    store.get(KEY).fee = "Covered by team lead";
    const res = await post({ eventId: "robo-race", email: "asha@example.com" });
    expect(res.status).toBe(200);
    const rec = store.get(KEY);
    expect(rec.status).toBe("confirmed");
    expect(rec.payment).toBe("not_required");
    expect(rec.paymentVerifiedBy).toBeUndefined();
  });
});
