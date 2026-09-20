import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Registering for Discoverize must cost nothing and must never send anybody
   to the payment portal — and the fee that appears later must be reachable
   only by a team the judges put through. */

const store = new Map<string, any>();
const sent: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => `payment-ref/${ref.trim().toLowerCase()}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
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

const EV = "discoverize-research-paper-presentation";
const ME = "student@example.com";
const KEY = `app/${EV}/${ME}.json`;
const post = async (b: any) =>
  (await POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;
const base = (over: any = {}) => ({
  name: "A Student", email: ME, phone: "9876543210", college: "RUAS", eventId: EV, ...over,
});

beforeEach(() => { store.clear(); sent.length = 0; });

describe("registering for Discoverize", () => {
  it("costs nothing and owes nothing", async () => {
    const res = await post(base());
    expect(res.status).toBe(200);
    const saved = store.get(KEY);
    expect(saved.payment).toBe("not_required");
    expect(saved.fee).toMatch(/^Free/);
    expect(saved.status).toBe("pending");
  });

  /* Every other event refuses a charged entry with no reference. This one
     must not ask for one at all. */
  it("does not demand a transaction reference", async () => {
    expect((await post(base())).status).toBe(200);
    expect(store.get(KEY).paymentRef ?? null).toBeNull();
  });

  it("still acknowledges the registration by email", async () => {
    await post(base());
    expect(sent).toHaveLength(1);
  });
});

describe("the fee gate", () => {
  const registered = (over: any = {}) => {
    store.set(KEY, {
      ticketId: "PRV-D", eventId: EV, eventName: "Discoverize (Research Paper Presentation)",
      status: "pending", payment: "not_required", fee: "Free · Rs. 200/- only if shortlisted",
      name: "A Student", email: ME, phone: "9876543210", college: "RUAS",
      teamName: null, teamCode: null, paymentRef: null, appliedAt: "2026-09-19T09:00:00.000Z", ...over,
    });
  };

  it("refuses a reference from a team that was never shortlisted", async () => {
    registered();
    const res = await post({ stage: "reference", eventId: EV, email: ME, paymentRef: "JIDCWIOOPNU1QEV" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(store.get(KEY).paymentRef).toBeNull();
  });

  it("refuses one from a team that submitted an abstract but is not through", async () => {
    registered({ round: { abstractSubmittedAt: "2026-09-19T10:00:00.000Z" } });
    const res = await post({ stage: "reference", eventId: EV, email: ME, paymentRef: "JIDCWIOOPNU1QEV" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  /* Shortlisting is what puts the fee on the row, and only then does the
     existing reference machinery apply. */
  it("takes the reference once the team is shortlisted and owes the fee", async () => {
    registered({
      payment: "awaiting", fee: "Rs. 200/-",
      round: { abstractSubmittedAt: "x", shortlistedAt: "y", shortlistedBy: "coord@example.com" },
    });
    const res = await post({ stage: "reference", eventId: EV, email: ME, paymentRef: "JIDCWIOOPNU1QEV" });
    expect(res.status).toBe(200);
    expect(store.get(KEY).paymentRef).toBe("JIDCWIOOPNU1QEV");
  });
});
