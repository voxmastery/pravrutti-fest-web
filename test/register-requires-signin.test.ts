import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The address decides whose registration this is, and a filed application is
   what blocks that person from registering themselves. Taking the address from
   the request body let a stranger quietly take somebody's place. */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null, authOn: true }));

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
vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => identity.email,
  authRequired: () => identity.authOn,
}));
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

const SOLO = "the-logic-circuit";
const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;
const body = (email: string) => ({
  name: "A Student", email, phone: "9876543210", college: "RUAS",
  eventId: SOLO, paymentRef: "JUNO-2026-0091",
});

beforeEach(() => { store.clear(); identity.email = null; identity.authOn = true; });

describe("whose registration this is", () => {
  it("refuses an application filed against an address nobody signed in as", async () => {
    const res = await post(body("victim@example.com"));
    expect(res.status).toBe(401);
    expect(store.has(`app/${SOLO}/victim@example.com.json`)).toBe(false);
  });

  it("files it under the signed-in address, not whatever the body claims", async () => {
    identity.email = "real@example.com";
    const res = await post(body("someone.else@example.com"));
    expect(res.status).toBe(200);
    expect(store.has(`app/${SOLO}/real@example.com.json`)).toBe(true);
    expect(store.has(`app/${SOLO}/someone.else@example.com.json`)).toBe(false);
  });

  /* Auth is off by configuration on the test site and in local work, where
     the form collects the address itself. */
  it("still takes the address from the form where sign-in is not configured", async () => {
    identity.authOn = false;
    const res = await post(body("guest@example.com"));
    expect(res.status).toBe(200);
    expect(store.has(`app/${SOLO}/guest@example.com.json`)).toBe(true);
  });
});
