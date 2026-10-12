import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Removing somebody from a team cancels their application. Treating that
   cancelled row as a live duplicate locked them out of the event entirely —
   they could not join another team, create one, rejoin, or be invited back,
   and every refusal told them they had "already applied". */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  listTeamMembers: async () => [],
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
vi.mock("@/lib/pravrutti-data", async (o) => {
  const actual = await o<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    effectiveRegistrationOpen: () => true,
    /* BRIDGE IT is closed on the live list. This file is about a cancelled row. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "bridge-it" ? { ...e, full: false } : e,
    ),
  };
});
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "bridge-it", CODE = "TEAMAAAA1111";
const MATE = "mate@example.com", LEAD = "lead@example.com";
const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;
const who = (email: string) => ({ email, name: "A Person", phone: "9876543210", college: "RUAS" });

function seedCancelledMate() {
  store.set(`app/${EV}/${MATE}.json`, {
    ticketId: "PRV-OLD", eventId: EV, email: MATE, name: "A Person",
    status: "cancelled", cancelledAt: new Date().toISOString(), payment: "not_required",
  });
  store.set(`member/${EV}/${MATE}.json`, { code: "", eventId: EV, member: null });
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Host", bio: "", createdByEmail: LEAD,
    members: [], createdAt: new Date().toISOString(),
  });
}

beforeEach(() => store.clear());

describe("a cancelled application is not a duplicate", () => {
  it("lets them join a team", async () => {
    seedCancelledMate();
    const res = await post({ action: "join", eventId: EV, code: CODE, ...who(MATE) });
    expect(res.status).toBe(200);
    expect(store.get(`app/${EV}/${MATE}.json`).status).toBe("pending");
  });

  it("lets them create their own team", async () => {
    seedCancelledMate();
    const res = await post({
      action: "create", eventId: EV, email: MATE, leadName: "A Person",
      phone: "9876543210", college: "RUAS", name: "Fresh Start", bio: "",
    });
    expect(res.status).toBe(200);
  });

  it("lets a lead invite them back", async () => {
    seedCancelledMate();
    const res = await post({
      action: "add_member", eventId: EV, code: CODE, email: LEAD, leadName: "Lead",
      college: "RUAS", memberName: "A Person", memberEmail: MATE, memberPhone: "9876543210",
    });
    expect(res.status).toBe(200);
  });

  /* The guard itself has to survive: a live application is still a duplicate,
     which is what stops one person taking two places. */
  it("still refuses someone with a live application", async () => {
    seedCancelledMate();
    store.set(`app/${EV}/${MATE}.json`, { ticketId: "PRV-LIVE", eventId: EV, email: MATE, status: "pending", payment: "awaiting" });
    const res = await post({ action: "join", eventId: EV, code: CODE, ...who(MATE) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already applied/i);
  });

  it("still refuses someone already holding a confirmed place", async () => {
    seedCancelledMate();
    store.set(`app/${EV}/${MATE}.json`, { ticketId: "PRV-CONF", eventId: EV, email: MATE, status: "confirmed", payment: "paid" });
    const res = await post({ action: "join", eventId: EV, code: CODE, ...who(MATE) });
    expect(res.status).toBe(409);
  });
});
