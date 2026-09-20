import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* They registered when they left to pay, so their name, phone and college
   were taken then. Re-submitting the whole form to attach one field asked for
   those again from a screen that never collected them — the answer came back
   "enter a 10-digit mobile number" with no field to put it in. */

const store = new Map<string, any>();
const sent: any[] = [];
const identity = vi.hoisted(() => ({ email: "student@example.com" as string | null }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  listTeamMembers: async () => [],
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email, authRequired: () => true }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }), resolveRoleFor: async () => ({ kind: "none" }) }));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/received-email", () => ({
  sendReceivedEmail: async (r: any) => { sent.push(r); return { sent: true }; },
}));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/register/route")); });

const EV = "the-logic-circuit", ME = "student@example.com";
const KEY = `app/${EV}/${ME}.json`;
const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;

/* Exactly what the row looks like after they clicked through to the portal. */
function midPayment(over: Record<string, unknown> = {}) {
  store.set(KEY, {
    ticketId: "PRV-MID", eventId: EV, eventName: "The Logic Circuit", email: ME,
    name: "A Student", phone: "9876543210", college: "RUAS",
    status: "pending", payment: "awaiting", fee: "Rs. 200/-",
    paymentRef: null, teamName: null, teamCode: null,
    appliedAt: new Date().toISOString(), ...over,
  });
}

beforeEach(() => { store.clear(); sent.length = 0; identity.email = ME; });

describe("adding a transaction ID to a registration that already exists", () => {
  /* The bug: this screen sends no name, phone or college, because it never
     asked for them. */
  it("does not ask again for details this screen never collected", async () => {
    midPayment();
    const res = await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" });
    expect(res.status).toBe(200);
    expect(store.get(KEY).paymentRef).toBe("JUNO-2026-0091");
  });

  it("keeps the ticket and the details they already gave", async () => {
    midPayment();
    await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" });
    const saved = store.get(KEY);
    expect(saved.ticketId).toBe("PRV-MID");
    expect(saved.phone).toBe("9876543210");
    expect(saved.name).toBe("A Student");
  });

  it("acknowledges it, since the first attempt never got that far", async () => {
    midPayment();
    await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" });
    expect(sent).toHaveLength(1);
  });

  /* They were already told once when they said they could not find the ID. */
  it("does not acknowledge twice", async () => {
    midPayment({ receivedEmailAt: new Date().toISOString() });
    await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" });
    expect(sent).toHaveLength(0);
  });

  it("still refuses a reference that could not be a receipt", async () => {
    midPayment();
    expect((await post({ stage: "reference", eventId: EV, paymentRef: "asdfgh" })).status).toBe(400);
  });

  it("still refuses one already recorded against somebody else", async () => {
    midPayment();
    store.set("payment-ref/juno-2026-0091.json", { eventId: EV, email: "other@example.com" });
    const res = await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" });
    expect(res.status).toBe(409);
    expect(store.get(KEY).paymentRef).toBeNull();
  });

  it("refuses when there is no registration to add to", async () => {
    expect((await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" })).status).toBe(404);
  });

  /* Nothing to add once an organiser has verified the money. */
  it("refuses when the payment is already settled", async () => {
    midPayment({ payment: "paid", paymentRef: "JUNO-2026-0001" });
    expect((await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" })).status).toBe(409);
  });

  it("refuses a signed-out caller", async () => {
    identity.email = null;
    midPayment();
    expect((await post({ stage: "reference", eventId: EV, paymentRef: "JUNO-2026-0091" })).status).toBe(401);
  });
});

describe("answering from the event page", () => {
  it("clears the intent mark even when no ID is given", async () => {
    midPayment({ stage: "intent" });
    const res = await post({ stage: "reference", eventId: EV, refUnavailable: true });
    expect(res.status).toBe(200);
    expect(store.get(KEY).stage).toBeUndefined();
    expect(store.get(KEY).paymentRef).toBeNull();
  });
});
