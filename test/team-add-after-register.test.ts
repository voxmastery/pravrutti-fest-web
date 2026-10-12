import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Adding a teammate once the team is already registered.
 *
 * The roster panel with the "add a member" button lives in the registration
 * dialog, which a lead who has submitted can no longer reach — so from My
 * Tickets the only way to grow a team was to read the code out and hope.
 * Nothing on the server stopped a later invite; the button simply was not
 * anywhere the lead could still press it.
 *
 * These tests pin the server side of that: a registered lead may still invite,
 * the details the ticket page cannot supply are filled in from the lead's own
 * registration, and the refusals that are still refusals — not the lead, a
 * duplicate, a closed window for a team that never got in — still refuse.
 * A closed window does not stop a lead who is already in.
 */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null }));
const open = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix = "") =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((url) => ({ url })),
  readPrivate: async () => null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("Blob already exists: overwrite not allowed");
    store.set(p, d);
  },
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([path, rec]) => path.startsWith(`member/${eventId}/`) && rec?.code === code && rec?.member)
      .map(([, rec]) => rec.member)
      .sort((a: any, b: any) => String(a.joinedAt).localeCompare(String(b.joinedAt))),
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email, authRequired: () => false }));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => ({ kind: "none" }),
  resolveRoleFor: async () => ({ kind: "none" }),
}));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => open.value,
}));

const invites: any[] = [];
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://pravrutti.tech/invite/${t}`,
  sendInviteEmail: async (args: any) => { invites.push(args); return { sent: true }; },
}));

let POST: typeof import("@/app/api/teams/route").POST;
let GET: typeof import("@/app/api/teams/route").GET;
beforeAll(async () => { ({ POST, GET } = await import("@/app/api/teams/route")); });

const EV = "bridge-it";
const CODE = "TEAMAAAA1111";
const LEAD = "lead@example.com";
const MATE = "mate@example.com";

const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;

const mine = async (): Promise<Response> =>
  (await GET(new Request(`http://t/api/teams?event=${EV}&mine=1`))) as Response;

/** A team whose lead has already submitted their own registration. */
function seedRegisteredTeam() {
  const at = "2026-09-20T06:00:00.000Z";
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD,
    members: [], createdAt: at,
  });
  store.set(`member/${EV}/${LEAD}.json`, {
    code: CODE, eventId: EV,
    member: { name: "Asha Rao", email: LEAD, phone: "9876543210", college: "Ramaiah Institute of Technology", joinedAt: at },
  });
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "BRIDGE IT", status: "pending", payment: "awaiting",
    fee: "Rs. 200/-", name: "Asha Rao", email: LEAD, phone: "9876543210",
    college: "Ramaiah Institute of Technology", teamName: "Bolt", teamCode: CODE, appliedAt: at,
  });
}

const addMate = (over: Record<string, unknown> = {}) =>
  post({
    action: "add_member", eventId: EV, code: CODE, email: LEAD,
    memberName: "Ravi Kumar", memberEmail: MATE, memberPhone: "9876543211", ...over,
  });

beforeEach(() => { store.clear(); invites.length = 0; identity.email = null; open.value = true; });

describe("adding a member after the team has registered", () => {
  it("lets a lead who has already submitted invite somebody", async () => {
    seedRegisteredTeam();
    const res = await addMate();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.memberCount).toBe(2);
    expect(body.invited).toEqual({ name: "Ravi Kumar", email: MATE });
    expect(body.inviteUrl).toMatch(/^https:\/\/pravrutti\.tech\/invite\/[a-f0-9]{64}$/);
    expect(store.get(`member/${EV}/${MATE}.json`).code).toBe(CODE);
  });

  /* The ticket page knows the lead's name but not their college, and the
     member inherits it — so it is read off the lead's own registration
     rather than asked for a second time. */
  it("takes the college from the lead's own registration when none is sent", async () => {
    seedRegisteredTeam();
    await addMate();
    expect(store.get(`member/${EV}/${MATE}.json`).member.college).toBe("Ramaiah Institute of Technology");
  });

  it("names the lead in the invite email from their registration", async () => {
    seedRegisteredTeam();
    await addMate();
    expect(invites[0].leadName).toBe("Asha Rao");
    expect(invites[0].teamName).toBe("Bolt");
  });

  it("still prefers what the client sends over the stored registration", async () => {
    seedRegisteredTeam();
    await addMate({ leadName: "Asha R.", college: "Another College" });
    expect(invites[0].leadName).toBe("Asha R.");
    expect(store.get(`member/${EV}/${MATE}.json`).member.college).toBe("Another College");
  });

  it("refuses anybody who is not the lead", async () => {
    seedRegisteredTeam();
    const res = await addMate({ email: MATE });
    expect(res.status).toBe(403);
  });

  it("still lets a registered lead add once registration has closed", async () => {
    seedRegisteredTeam();
    open.value = false;
    expect((await addMate()).status).toBe(200);
    expect(store.has(`member/${EV}/${MATE}.json`)).toBe(true);
  });

  it("still lets a confirmed lead add once registration has closed", async () => {
    seedRegisteredTeam();
    store.get(`app/${EV}/${LEAD}.json`).status = "confirmed";
    store.get(`app/${EV}/${LEAD}.json`).payment = "paid";
    open.value = false;
    expect((await addMate()).status).toBe(200);
  });

  /* The window closing is what stops a team that never got in. A lead who
     withdrew, or who minted a code and never submitted, is not a team in
     the field. */
  it("refuses once registration has closed when the lead is not registered", async () => {
    seedRegisteredTeam();
    store.get(`app/${EV}/${LEAD}.json`).status = "cancelled";
    open.value = false;
    expect((await addMate()).status).toBe(409);
  });

  it("refuses somebody already registered for this event", async () => {
    seedRegisteredTeam();
    store.set(`app/${EV}/${MATE}.json`, {
      ticketId: "PRV-M", eventId: EV, eventName: "BRIDGE IT", status: "pending", payment: "awaiting",
      fee: "Rs. 200/-", name: "Ravi Kumar", email: MATE, phone: "9876543211", college: "RUAS",
      teamName: null, teamCode: null, appliedAt: "2026-09-20T07:00:00.000Z",
    });
    const res = await addMate();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already registered/i);
  });
});

/* The button is drawn from what `mine` says. A closed window turns canInvite
   off and names the reason, including for a lead who is already in. */
describe("what the ticket page is told about inviting", () => {
  it("says invites are still possible while registration is open", async () => {
    seedRegisteredTeam();
    identity.email = LEAD;
    const body = await (await mine()).json();
    expect(body.team.isLead).toBe(true);
    expect(body.team.canInvite).toBe(true);
  });

  it("says a registered lead can still invite once registration has closed", async () => {
    seedRegisteredTeam();
    identity.email = LEAD;
    open.value = false;
    const body = await (await mine()).json();
    expect(body.team.canInvite).toBe(true);
    expect(body.team.inviteBlockedReason).toBeNull();
  });

  it("says they cannot invite once registration has closed and the lead is not registered", async () => {
    seedRegisteredTeam();
    store.get(`app/${EV}/${LEAD}.json`).status = "cancelled";
    identity.email = LEAD;
    open.value = false;
    const body = await (await mine()).json();
    expect(body.team.canInvite).toBe(false);
  });
});
