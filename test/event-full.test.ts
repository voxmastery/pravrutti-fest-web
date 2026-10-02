import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * An event marked full takes no new teams — and nothing else changes.
 *
 * Hacktivate's cap is 45 teams and 52 were already holding places, while the
 * page read "37 of 45" and kept inviting more. The organisers need to stop
 * new teams while they decide on the ones in review, so an event can be
 * switched to full by hand. A switch rather than an automatic cap, because
 * mid-review an automatic one reopens the moment a single team is declined
 * or moved, and a stranger takes the place being decided.
 *
 * "Full" means no new entry in the field: no new team, no new lead or solo
 * registration. It must not mean "nobody may touch this event": Nexovate is a
 * Hacktivate team whose two members still have to join it. So joining a team
 * whose lead is registered keeps working, a registered lead can still add
 * people, and someone who left for the payment portal before the switch can
 * still come back and finish — refusing them would not return their money.
 * A team whose lead never registered cannot get in, so it cannot grow either.
 */

const store = new Map<string, any>();
const who = vi.hoisted(() => ({ email: null as string | null }));

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
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => who.email, authRequired: () => false }));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => ({ kind: "none" }),
  resolveRoleFor: async () => ({ kind: "none" }),
}));
/* Two events switched to full by the test, whatever the real data says, so
   reopening an event never breaks this file — and Robo Race given a cap of
   two teams, to exercise closing automatically at the cap. */
vi.mock("@/lib/pravrutti-data", async (o) => {
  const real = await o<typeof import("@/lib/pravrutti-data")>();
  const FULL = new Set(["line-follower", "the-logic-circuit"]);
  return {
    ...real,
    registrationOpen: () => true,
    effectiveRegistrationOpen: () => true,
    events: real.events.map((e) => {
      const id = real.eventId(e.name);
      if (id === "robo-race") return { ...e, full: false, maxTeams: 2, registrationCloses: undefined };
      return { ...e, full: FULL.has(id), registrationCloses: undefined };
    }),
  };
});
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/received-email", () => ({ sendReceivedEmail: async () => ({ sent: true }) }));

let teams: typeof import("@/app/api/teams/route").POST;
let register: typeof import("@/app/api/register/route").POST;
let accept: typeof import("@/app/invite/[token]/route").GET;
let counts: typeof import("@/app/api/register/route").GET;
beforeAll(async () => {
  ({ POST: teams } = await import("@/app/api/teams/route"));
  ({ POST: register, GET: counts } = await import("@/app/api/register/route"));
  ({ GET: accept } = await import("@/app/invite/[token]/route"));
});

const FULL_EV = "line-follower";
const OPEN_EV = "chaos";
const SOLO_FULL_EV = "the-logic-circuit";
const CODE = "TEAMAAAA1111";
const LEAD = "lead@example.com", MATE = "mate@example.com";
const AT = "2026-09-29T10:00:00.000Z";
const TOKEN = "c".repeat(64);

const post = async (fn: (r: Request) => Promise<Response>, url: string, body: unknown) => {
  const res = (await fn(new Request(url, { method: "POST", body: JSON.stringify(body) }))) as Response;
  return { status: res.status, body: await res.json() };
};
const teamsCall = (b: unknown) => post(teams as any, "http://t/api/teams", b);
const registerCall = (b: unknown) => post(register as any, "http://t/api/register", b);

/** A team on `ev` led by LEAD, whose lead is registered or never registered. */
function seedTeam(ev: string, leadRegistered: boolean) {
  store.set(`team/${ev}/${CODE}.json`, {
    code: CODE, eventId: ev, name: "Bolt", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  store.set(`member/${ev}/${LEAD}.json`, {
    code: CODE, eventId: ev,
    member: { name: "Asha Rao", email: LEAD, phone: "9876543210", college: "RUAS", joinedAt: AT },
  });
  if (leadRegistered)
    store.set(`app/${ev}/${LEAD}.json`, {
      ticketId: "PRV-LEAD", eventId: ev, eventName: ev, status: "pending", payment: "awaiting",
      fee: "Rs. 200/-", name: "Asha Rao", email: LEAD, phone: "9876543210", college: "RUAS",
      teamName: "Bolt", teamCode: CODE, paymentRef: "J5N3Z8Y0MUQG1UY", appliedAt: AT,
    });
}

const createBody = (ev: string) => ({
  action: "create", eventId: ev, name: "New Team", leadName: "Newcomer",
  phone: "9876543219", college: "RVCE", email: "newcomer@example.com",
});
const joinBody = (ev: string) => ({
  action: "join", eventId: ev, code: CODE, name: "Ravi Kumar",
  phone: "9876543211", college: "RUAS", email: MATE,
});
const addBody = (ev: string) => ({
  action: "add_member", eventId: ev, code: CODE, email: LEAD,
  memberName: "Ravi Kumar", memberEmail: MATE, memberPhone: "9876543211",
});
const soloBody = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao", email: "asha@example.com", phone: "9876543210",
  college: "Ramaiah Institute of Technology", eventId: SOLO_FULL_EV, ...over,
});

beforeEach(() => { store.clear(); who.email = null; });

describe("a full event takes no new entries", () => {
  it("refuses to create a new team, and says why", async () => {
    const res = await teamsCall(createBody(FULL_EV));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
    expect([...store.keys()].some((k) => k.startsWith(`team/${FULL_EV}/`))).toBe(false);
  });

  it("only applies to the event that is full", async () => {
    expect((await teamsCall(createBody(OPEN_EV))).status).toBe(200);
  });

  it("refuses a new solo registration", async () => {
    const res = await registerCall(soloBody({ paymentRef: "J5N3Z8Y0MUQG1UY" }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
    expect(store.get(`app/${SOLO_FULL_EV}/asha@example.com.json`)).toBeUndefined();
  });

  /* The intent row is written as they leave for the payment portal. Refusing
     it is the point: nobody should be sent to pay for a full event. */
  it("refuses to start someone new towards the payment portal", async () => {
    expect((await registerCall(soloBody({ stage: "intent" }))).status).toBe(409);
  });

  /* Nor does it claim their receipt reference on the way to refusing them. */
  it("does not spend a refused applicant's transaction ID", async () => {
    await registerCall(soloBody({ paymentRef: "J5N3Z8Y0MUQG1UY" }));
    expect(store.get("payment-ref/j5n3z8y0muqg1uy.json")).toBeUndefined();
  });

  /* They left for the portal before the event filled and may well have paid.
     Refusing them now would not give the money back. */
  it("lets someone who was already mid-payment finish", async () => {
    store.set(`app/${SOLO_FULL_EV}/asha@example.com.json`, {
      ticketId: "PRV-MID", eventId: SOLO_FULL_EV, eventName: "The Logic Circuit", status: "pending",
      payment: "awaiting", fee: "Rs. 200/-", name: "Asha Rao", email: "asha@example.com",
      phone: "9876543210", college: "Ramaiah Institute of Technology", teamName: null, teamCode: null,
      paymentRef: null, stage: "intent", appliedAt: AT,
    });
    const res = await registerCall(soloBody({ paymentRef: "J5N3Z8Y0MUQG1UY" }));
    expect(res.status).toBe(200);
    expect(store.get(`app/${SOLO_FULL_EV}/asha@example.com.json`).paymentRef).toBe("J5N3Z8Y0MUQG1UY");
  });
});

describe("teams already in keep working", () => {
  it("lets someone join a team whose lead is registered", async () => {
    seedTeam(FULL_EV, true);
    const res = await teamsCall(joinBody(FULL_EV));
    expect(res.status).toBe(200);
    expect(store.get(`app/${FULL_EV}/${MATE}.json`)).toBeTruthy();
  });

  it("lets a registered lead add a teammate", async () => {
    seedTeam(FULL_EV, true);
    expect((await teamsCall(addBody(FULL_EV))).status).toBe(200);
  });

  it("lets an invited teammate accept into a team whose lead is registered", async () => {
    seedTeam(FULL_EV, true);
    store.set(`invite/${TOKEN}.json`, { token: TOKEN, eventId: FULL_EV, code: CODE, email: MATE, createdAt: AT });
    store.set(`member/${FULL_EV}/${MATE}.json`, {
      code: CODE, eventId: FULL_EV,
      member: { name: "Ravi Kumar", email: MATE, phone: "9876543211", college: "RUAS", invitedAt: AT, inviteToken: TOKEN },
    });
    const res = await accept(new Request(`https://pravrutti.tech/invite/${TOKEN}`), { params: Promise.resolve({ token: TOKEN }) });
    expect(res.headers.get("location")).not.toContain("/invite/problem");
    expect(store.get(`app/${FULL_EV}/${MATE}.json`)).toBeTruthy();
  });
});

/* A team holding a place on Robo Race (cap: two teams, through the mock). */
function holdPlace(n: number, over: Record<string, unknown> = {}) {
  const email = `lead${n}@example.com`;
  store.set(`app/robo-race/${email}.json`, {
    ticketId: `PRV-${n}`, eventId: "robo-race", eventName: "ROBO RACE", status: "pending",
    payment: "awaiting", fee: "Rs. 200/-", name: `Lead ${n}`, email, phone: "9876543210",
    college: "RUAS", teamName: `Team ${n}`, teamCode: `TEAMRR00000${n}`,
    paymentRef: "J5N3Z8Y0MUQG1U" + n, appliedAt: AT, ...over,
  });
}

describe("an event closes on its own when it reaches its cap", () => {
  it("refuses a new team once the cap is reached", async () => {
    holdPlace(1);
    holdPlace(2);
    const res = await teamsCall(createBody("robo-race"));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
  });

  it("takes a new team while there is still room", async () => {
    holdPlace(1);
    expect((await teamsCall(createBody("robo-race"))).status).toBe(200);
  });

  /* The same count the desk shows: in review and confirmed hold a place;
     somebody who withdrew, or left for the portal and never came back with
     a receipt, does not — or a handful of abandoned attempts would shut an
     event that has room. */
  it("does not count withdrawn or abandoned registrations against the cap", async () => {
    holdPlace(1);
    holdPlace(2, { status: "cancelled" });
    holdPlace(3, { paymentRef: null });
    expect((await teamsCall(createBody("robo-race"))).status).toBe(200);
  });

  it("still lets a team that is in grow once the cap is reached", async () => {
    holdPlace(1);
    holdPlace(2);
    seedTeam("robo-race", true);
    expect((await teamsCall(joinBody("robo-race"))).status).toBe(200);
  });

  /* The event page reads this to say "Full" without waiting for someone to
     be refused. */
  it("tells the event page which events are full", async () => {
    holdPlace(1);
    holdPlace(2);
    const res = await counts(new Request("http://t/api/register"));
    const body = await res.json();
    expect(body.full["robo-race"]).toBe(true);
    expect(body.full["line-follower"]).toBe(true);
    expect(body.full["chaos"]).toBe(false);
  });

  it("reopens on its own when a place frees up", async () => {
    holdPlace(1);
    holdPlace(2, { status: "declined" });
    const body = await (await counts(new Request("http://t/api/register"))).json();
    expect(body.full["robo-race"]).toBe(false);
  });
});

describe("a team that never got in cannot grow", () => {
  it("refuses joining a team whose lead never registered", async () => {
    seedTeam(FULL_EV, false);
    const res = await teamsCall(joinBody(FULL_EV));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
    expect(store.get(`app/${FULL_EV}/${MATE}.json`)).toBeUndefined();
  });

  it("refuses a lead who never registered adding teammates", async () => {
    seedTeam(FULL_EV, false);
    expect((await teamsCall(addBody(FULL_EV))).status).toBe(409);
  });

  it("turns an invite into such a team away with a page that says why", async () => {
    seedTeam(FULL_EV, false);
    store.set(`invite/${TOKEN}.json`, { token: TOKEN, eventId: FULL_EV, code: CODE, email: MATE, createdAt: AT });
    store.set(`member/${FULL_EV}/${MATE}.json`, {
      code: CODE, eventId: FULL_EV,
      member: { name: "Ravi Kumar", email: MATE, phone: "9876543211", college: "RUAS", invitedAt: AT, inviteToken: TOKEN },
    });
    const res = await accept(new Request(`https://pravrutti.tech/invite/${TOKEN}`), { params: Promise.resolve({ token: TOKEN }) });
    expect(res.headers.get("location")).toContain("/invite/problem?reason=full");
    expect(store.get(`app/${FULL_EV}/${MATE}.json`)).toBeUndefined();
  });
});
