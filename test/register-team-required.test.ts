import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* 21 of the 24 events are team-only (teamSize.soloAllowed === false). Letting
   someone in alone there books a place the event cannot actually run — ROBO RACE
   needs a minimum of 2 — so the rule is enforced on the server, not only hidden
   in the dialog. */

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
vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/register/route"));
});

const TEAM_EVENT = "robo-race";        // soloAllowed: false, min 2
const SOLO_EVENT = "the-logic-circuit"; // soloAllowed: true
const CODE = "ROBO123456";

const base = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  eventId: TEAM_EVENT,
  paymentRef: "JUNO-2026-0091",
  ...over,
});
const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => store.clear());

describe("POST /api/register — team-only events", () => {
  it("refuses a solo entry for a team-only event", async () => {
    const res = await post(base());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/team/i);
  });

  it("accepts the same event once they have a team", async () => {
    store.set(`team/${TEAM_EVENT}/${CODE}.json`, {
      code: CODE, eventId: TEAM_EVENT, name: "Bolt", bio: "",
      createdByEmail: "asha@example.com",
      members: [{ name: "Asha Rao", email: "asha@example.com" }],
      createdAt: new Date().toISOString(),
    });
    expect((await post(base({ teamCode: CODE }))).status).toBe(200);
  });

  it("still lets a solo entry through where the event allows it", async () => {
    expect((await post(base({ eventId: SOLO_EVENT }))).status).toBe(200);
  });
});
