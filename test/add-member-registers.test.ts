import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * A teammate the lead adds is on the team.
 *
 * Adding someone used to send an invite and wait: until they clicked it they
 * had no registration, no ticket, and showed as "Invite not accepted" — and
 * with the fest mailbox at its sending limit most invites never arrived. On
 * 6 Oct 2026 379 teammates sat like that, 169 of them on confirmed teams.
 * The organisers' call: a lead entering a teammate's email has added them.
 * They are registered the moment they are added, covered by the lead's fee,
 * confirmed if the team is; the invite email still goes, as a heads-up.
 */

const store = new Map<string, any>();
const who = vi.hoisted(() => ({ email: null as string | null }));
const invitesSent: string[] = [];
const tickets: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([k, v]) => k.startsWith(`member/${eventId}/`) && v?.code === code && v?.member)
      .map(([, v]) => v.member),
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
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => who.email, authRequired: () => true }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }), resolveRoleFor: async () => ({ kind: "none" }) }));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async (a: any) => { invitesSent.push(a.to); return { sent: true }; },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: { email?: string }) => { tickets.push(String(a?.email ?? "")); return { sent: true }; },
}));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "robo-race", CODE = "ROBODRIFT001", LEAD = "lead@x.com", MATE = "mate@x.com";
const AT = "2026-10-05T10:58:00.000Z";

const add = async () => {
  const res = (await POST(new Request("http://t/api/teams", {
    method: "POST",
    body: JSON.stringify({
      action: "add_member", eventId: EV, code: CODE,
      memberName: "Thanushree B R", memberEmail: MATE, memberPhone: "7259438742",
    }),
  }))) as Response;
  return { status: res.status, body: await res.json() };
};
const leadRow = (over: Record<string, unknown> = {}) =>
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "ROBO RACE", status: "pending", payment: "awaiting",
    fee: "Rs. 200/-", name: "Poojashree H", email: LEAD, phone: "7975152343", college: "RUAS",
    teamName: "Robo Drift", teamCode: CODE, appliedAt: AT, paymentRef: "TMHKSWOQJC4TBCO", ...over,
  });
const mateApp = () => store.get(`app/${EV}/${MATE}.json`);
const mateMember = () => store.get(`member/${EV}/${MATE}.json`)?.member;

beforeEach(() => {
  store.clear(); invitesSent.length = 0; tickets.length = 0;
  who.email = LEAD;
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Robo Drift", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  store.set(`member/${EV}/${LEAD}.json`, { code: CODE, eventId: EV, member: { name: "Poojashree H", email: LEAD, phone: "7975152343", college: "RUAS", joinedAt: AT } });
  leadRow();
});

describe("a lead adding a teammate", () => {
  it("registers the teammate on the spot, covered by the lead", async () => {
    expect((await add()).status).toBe(200);
    expect(mateApp()).toMatchObject({
      eventId: EV, email: MATE, name: "Thanushree B R", phone: "7259438742", college: "RUAS",
      teamCode: CODE, teamName: "Robo Drift", payment: "not_required", fee: "Covered by team lead",
    });
    expect(mateApp().ticketId).toMatch(/^PRV-[0-9A-F]{16}$/);
  });

  it("leaves them in review while the team is, with no ticket email", async () => {
    await add();
    expect(mateApp().status).toBe("pending");
    expect(tickets).toEqual([]);
    expect(mateApp().confirmationEmailAt).toBeUndefined();
  });

  it("confirms them and emails a ticket when the team already is", async () => {
    leadRow({ status: "confirmed", payment: "paid" });
    await add();
    expect(mateApp().status).toBe("confirmed");
    expect(tickets).toEqual([MATE]);
    expect(mateApp().confirmationEmailAt).toBeTruthy();
  });

  it("puts them on the roster as joined, not waiting on an invite", async () => {
    const { body } = await add();
    expect(mateMember().acceptedAt).toBeTruthy();
    expect(mateMember().invitedAt).toBeTruthy();
    const listed = body.team.members ?? body.team.roster ?? [];
    expect(JSON.stringify(listed)).not.toMatch(/"invited"/);
  });

  it("still tells them by email", async () => {
    await add();
    expect(invitesSent).toEqual([MATE]);
  });

  it("does not register someone already registered for the event", async () => {
    store.set(`app/${EV}/${MATE}.json`, { email: MATE, eventId: EV, status: "confirmed", payment: "paid", teamCode: "OTHERTEAM001" });
    expect((await add()).status).toBe(409);
    expect(mateApp().teamCode).toBe("OTHERTEAM001");
  });

  it("only lets the lead add", async () => {
    who.email = "stranger@x.com";
    expect((await add()).status).toBe(403);
    expect(mateApp()).toBeUndefined();
  });
});
