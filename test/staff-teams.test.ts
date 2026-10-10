import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const store = new Map<string, any>();
const role = vi.hoisted(() => ({ current: { kind: "none" } as { kind: string; eventIds?: string[] } }));
const identity = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => {
    store.set(p, data);
  },
  listTeamMembers: async () => [],
}));

vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => identity.email,
  authRequired: () => false,
}));

vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));

vi.mock("@/lib/pravrutti-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    registrationOpen: () => true,
    effectiveRegistrationOpen: () => true,
    /* Students still create a team here. Closing ROBO RACE on the live
       data must not change what the staff block is proving. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "robo-race" ? { ...e, full: false } : e,
    ),
  };
});

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/teams/route"));
});

const createBody = (over: Record<string, unknown> = {}) => ({
  action: "create",
  eventId: "robo-race",
  name: "Bolt",
  leadName: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  ...over,
});

const joinBody = (over: Record<string, unknown> = {}) => ({
  action: "join",
  eventId: "robo-race",
  code: "ABCD23",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  ...over,
});

const post = async (b: Record<string, unknown>) => {
  const res = await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }));
  if (!res) throw new Error("expected a response");
  return res;
};

beforeEach(() => {
  store.clear();
  role.current = { kind: "none" };
  identity.email = null;
});

describe("POST /api/teams — staff cannot apply", () => {
  it("rejects an organiser creating a team", async () => {
    role.current = { kind: "organiser" };
    identity.email = "boss@pravrutti.test";
    const res = await post(createBody());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/staff/i);
    expect(store.size).toBe(0);
  });

  it("rejects a coordinator joining a team", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race"] };
    identity.email = "arbharaath@gmail.com";
    store.set("team/robo-race/ABCD23.json", {
      code: "ABCD23",
      eventId: "robo-race",
      name: "Bolt",
      bio: "",
      createdByEmail: "lead@example.com",
      members: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const res = await post(joinBody());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/staff/i);
  });

  it("still lets a student create a team", async () => {
    const res = await post(createBody());
    expect(res.status).toBe(200);
  });
});
