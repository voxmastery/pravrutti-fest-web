import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Deleting a team only tombstones the team. It does not reach the teammates,
   who keep a live application pointing at something that no longer exists —
   and it does not reach the lead's own membership either, which then refers
   to a team that is gone. */

const store = new Map<string, any>();
let roster: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  listTeamMembers: async () => roster,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
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

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "bridge-it", CODE = "TEAMBBBB2222", LEAD = "lead@example.com", MATE = "mate@example.com";
const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;

function seedTeam(withMate: boolean) {
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD,
    members: [], createdAt: new Date().toISOString(),
  });
  roster = withMate
    ? [{ email: LEAD, name: "Lead" }, { email: MATE, name: "Mate" }]
    : [{ email: LEAD, name: "Lead" }];
}

beforeEach(() => { store.clear(); roster = []; });

describe("deleting a team", () => {
  it("is refused while a teammate is still on it", async () => {
    seedTeam(true);
    const res = await post({ action: "delete", eventId: EV, code: CODE, email: LEAD });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/remove them first/i);
    expect(store.get(`team/${EV}/${CODE}.json`).deletedAt).toBeUndefined();
  });

  it("goes through once the lead is alone on it", async () => {
    seedTeam(false);
    const res = await post({ action: "delete", eventId: EV, code: CODE, email: LEAD });
    expect(res.status).toBe(200);
    expect(store.get(`team/${EV}/${CODE}.json`).deletedAt).toBeTruthy();
  });
});

describe("a membership pointing at a team that is gone", () => {
  /* Deleting leaves the lead's own membership behind. Reading that as "you
     are already on a team" left them unable to start another one. */
  it("does not stop the lead creating a new team", async () => {
    store.set(`member/${EV}/${LEAD}.json`, { code: CODE, eventId: EV, member: { email: LEAD } });
    store.set(`team/${EV}/${CODE}.json`, {
      code: CODE, eventId: EV, name: "Bolt", createdByEmail: LEAD,
      members: [], createdAt: new Date().toISOString(), deletedAt: new Date().toISOString(),
    });
    const res = await post({
      action: "create", eventId: EV, email: LEAD, leadName: "Lead",
      phone: "9876543210", college: "RUAS", name: "Second Try", bio: "",
    });
    expect(res.status).toBe(200);
  });

  /* A membership pointing at a team that still exists is not a tombstone —
     they get that team back rather than a second one. */
  it("still returns the live team when it is actually there", async () => {
    store.set(`member/${EV}/${LEAD}.json`, { code: CODE, eventId: EV, member: { email: LEAD } });
    store.set(`team/${EV}/${CODE}.json`, {
      code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD,
      members: [], createdAt: new Date().toISOString(),
    });
    const res = await post({
      action: "create", eventId: EV, email: LEAD, leadName: "Lead",
      phone: "9876543210", college: "RUAS", name: "Duplicate", bio: "",
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.restored).toBe(true);
    expect(body.code).toBe(CODE);
  });
});
