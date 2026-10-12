import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The fee is paid on the college Juno portal before applying, so a charged
   application has to carry the receipt's transaction ID. Only the people who
   are actually charged: a solo applicant or a team lead. Joiners are covered
   by their lead and must not be asked for one. */

const store = new Map<string, any>();

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

const EVENT = "the-logic-circuit"; // solo-allowed, so these tests exercise phone/ref rules, not the team rule
const CODE = "ROBO123456";
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
const team = (createdByEmail: string) => ({
  code: CODE,
  eventId: EVENT,
  name: "Bolt",
  bio: "",
  createdByEmail,
  members: [{ name: "Asha Rao", email: "asha@example.com" }],
  createdAt: new Date().toISOString(),
});

beforeEach(() => store.clear());

describe("POST /api/register — Juno transaction ID", () => {
  /* Required for whoever is charged: they have just paid on the portal, and the
     receipt reference is the only thing they can prove it with. */
  it("refuses a solo application without a transaction ID", async () => {
    const res = await post(base());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Transaction Reference No/i);
  });

  /* A present-but-junk reference is worse than none: it looks like proof on
     the desk. */
  it("refuses one that could not be a receipt reference", async () => {
    expect((await post(base({ paymentRef: "asdfgh" }))).status).toBe(400);
    expect((await post(base({ paymentRef: "12345" }))).status).toBe(400);
  });

  it("accepts a solo application with one and stores it", async () => {
    expect((await post(base({ paymentRef: " JUNO-2026-0091 " }))).status).toBe(200);
    expect(store.get(`app/${EVENT}/asha@example.com.json`).paymentRef).toBe("JUNO-2026-0091");
  });

  it("refuses a team lead without one — the lead pays", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, team("asha@example.com"));
    expect((await post(base({ teamCode: CODE }))).status).toBe(400);
  });

  it("lets a joiner through without one — covered by the lead", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, team("lead@example.com"));
    const res = await post(base({ teamCode: CODE }));
    expect(res.status).toBe(200);
    expect(store.get(`app/${EVENT}/asha@example.com.json`).paymentRef).toBeNull();
  });
});
