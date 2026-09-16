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
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null }));
vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/register/route"));
});

const EVENT = "robo-race";
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
  /* Optional since Path B: it auto-verifies from the Juno registration ID, so
     the transaction ID is a cross-check we record when given, not a gate. */
  it("accepts a solo application without a transaction ID and stores null", async () => {
    expect((await post(base())).status).toBe(200);
    expect(store.get(`app/${EVENT}/asha@example.com.json`).paymentRef).toBeNull();
  });

  it("accepts a solo application with one and stores it", async () => {
    expect((await post(base({ paymentRef: " JUNO-2026-0091 " }))).status).toBe(200);
    expect(store.get(`app/${EVENT}/asha@example.com.json`).paymentRef).toBe("JUNO-2026-0091");
  });

  it("lets a team lead through without one", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, team("asha@example.com"));
    expect((await post(base({ teamCode: CODE }))).status).toBe(200);
  });

  it("lets a joiner through without one — covered by the lead", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, team("lead@example.com"));
    const res = await post(base({ teamCode: CODE }));
    expect(res.status).toBe(200);
    expect(store.get(`app/${EVENT}/asha@example.com.json`).paymentRef).toBeNull();
  });
});
