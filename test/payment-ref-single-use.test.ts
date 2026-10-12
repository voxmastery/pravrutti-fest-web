import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* A reference is the only evidence a payment happened. Nothing stopped two
   people quoting the same one, so a shared screenshot registered the second of
   them for nothing — and one payment could be claimed across two events. */

const store = new Map<string, any>();

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
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }), resolveRoleFor: async () => ({ kind: "none" }) }));
vi.mock("@/lib/pravrutti-data", async (o) => {
  const actual = await o<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    effectiveRegistrationOpen: () => true,
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "the-logic-circuit" ? { ...e, full: false } : e,
    ),
  };
});
vi.mock("@/lib/received-email", () => ({ sendReceivedEmail: async () => ({ sent: true }) }));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/register/route")); });

const SOLO = "the-logic-circuit", REF = "JUNO-2026-0091";
const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;
const who = (email: string, eventId = SOLO) => ({
  name: "A Student", email, phone: "9876543210", college: "RUAS", eventId,
});

beforeEach(() => store.clear());

describe("a payment reference covers one entry", () => {
  it("accepts the first person to quote it", async () => {
    expect((await post({ ...who("first@example.com"), paymentRef: REF })).status).toBe(200);
  });

  it("turns away a second person quoting the same one", async () => {
    await post({ ...who("first@example.com"), paymentRef: REF });
    const res = await post({ ...who("second@example.com"), paymentRef: REF });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already recorded/i);
    expect(store.has(`app/${SOLO}/second@example.com.json`)).toBe(false);
  });

  /* Case and padding are how the same receipt gets typed twice, not how two
     different payments look. */
  it("is not fooled by different spacing or case", async () => {
    await post({ ...who("first@example.com"), paymentRef: REF });
    const res = await post({ ...who("third@example.com"), paymentRef: "  juno-2026-0091 " });
    expect(res.status).toBe(409);
  });

  it("refuses the same receipt claimed for a second event", async () => {
    await post({ ...who("first@example.com"), paymentRef: REF });
    const res = await post({ ...who("first@example.com", "discoverize-research-paper-presentation"), paymentRef: REF });
    expect(res.status).toBe(409);
  });

  /* Sending the same completed registration twice is still refused — but by
     the duplicate guard, for having already applied. It must not be turned
     away as though somebody else held their reference, which would tell them
     their own receipt belonged to a stranger. */
  it("does not accuse someone of stealing their own reference", async () => {
    await post({ ...who("first@example.com"), paymentRef: REF });
    const res = await post({ ...who("first@example.com"), paymentRef: REF });
    const { error } = await res.json();
    expect(error).toMatch(/already applied/i);
    expect(error).not.toMatch(/already recorded/i);
  });

  /* Completing an intent is exactly that resubmission, and is the path most
     people take. */
  it("lets somebody finish the registration they started before paying", async () => {
    await post({ ...who("first@example.com"), stage: "intent" });
    const res = await post({ ...who("first@example.com"), paymentRef: REF });
    expect(res.status).toBe(200);
    expect(store.get(`app/${SOLO}/first@example.com.json`).paymentRef).toBe(REF);
  });
});
