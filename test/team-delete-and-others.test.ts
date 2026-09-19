import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Deleting a team is a tombstone, because the store has no delete operation.
   What matters is that every reader then treats it as gone — otherwise a code
   for a dissolved team would still let people join. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: `mem:${k}` })),
  readPrivate: async (url: string) => store.get(url.replace(/^mem:/, "")) ?? null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `team-member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
  listTeamMembers: async () => [],
}));
vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => "lead@example.com",
  authRequired: () => false,
}));
vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/teams/route"));
});

const EV = "robo-race";
const OTHER = "respawn";
const CODE = "ROBO12345678";
const post = async (b: Record<string, unknown>) =>
  (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) })))!;

const team = (evId: string, code: string, createdBy = "lead@example.com", name = "Null Pointers") => ({
  code, eventId: evId, name, bio: "", createdByEmail: createdBy,
  members: [{ name: "Lead", email: createdBy, phone: "9876543210", college: "C", joinedAt: "2026-09-01T00:00:00.000Z" }],
  createdAt: "2026-09-01T00:00:00.000Z",
});

beforeEach(() => store.clear());

describe("POST /api/teams — delete", () => {
  it("lets the lead delete their own team", async () => {
    store.set(`team/${EV}/${CODE}.json`, team(EV, CODE));
    const res = await post({ action: "delete", eventId: EV, code: CODE });
    expect(res.status).toBe(200);
    expect(store.get(`team/${EV}/${CODE}.json`).deletedAt).toBeTruthy();
  });

  /* The whole point of the tombstone: the code must stop working afterwards. */
  it("makes the code stop resolving once deleted", async () => {
    store.set(`team/${EV}/${CODE}.json`, { ...team(EV, CODE), deletedAt: "2026-09-02T00:00:00.000Z" });
    const res = await post({ action: "verify", eventId: EV, code: CODE });
    expect(res.status).toBe(404);
  });

  it("refuses when the requester is not the lead", async () => {
    store.set(`team/${EV}/${CODE}.json`, team(EV, CODE, "someone.else@example.com"));
    const res = await post({ action: "delete", eventId: EV, code: CODE });
    expect(res.status).toBe(403);
  });

  it("404s on a team that does not exist", async () => {
    expect((await post({ action: "delete", eventId: EV, code: CODE })).status).toBe(404);
  });
});

describe("POST /api/teams — others", () => {
  it("lists the person's teams from other events, not this one", async () => {
    store.set(`team/${EV}/${CODE}.json`, team(EV, CODE, "lead@example.com", "This Event"));
    store.set(`team/${OTHER}/RESPAWN12345.json`, team(OTHER, "RESPAWN12345", "lead@example.com", "Null Pointers"));
    const res = await post({ action: "others", eventId: EV });
    const body = await res.json();
    expect(body.teams).toHaveLength(1);
    expect(body.teams[0]).toMatchObject({ eventId: OTHER, name: "Null Pointers", isLead: true });
  });

  it("ignores deleted teams", async () => {
    store.set(`team/${OTHER}/RESPAWN12345.json`, {
      ...team(OTHER, "RESPAWN12345"), deletedAt: "2026-09-02T00:00:00.000Z",
    });
    expect((await (await post({ action: "others", eventId: EV })).json()).teams).toHaveLength(0);
  });

  it("ignores teams belonging to someone else", async () => {
    store.set(`team/${OTHER}/RESPAWN12345.json`, team(OTHER, "RESPAWN12345", "stranger@example.com"));
    expect((await (await post({ action: "others", eventId: EV })).json()).teams).toHaveLength(0);
  });
});
