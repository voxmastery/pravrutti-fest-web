import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* What a lead actually does with a team over an afternoon: make one, think
   better of it, delete it, make another; or delete it and join a friend's.
   Every step against a store that enforces the duplicate guard, because the
   dev store does not and hid exactly this. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  listTeamMembers: async (e: string, code: string) =>
    [...store.entries()]
      .filter(([k, v]) => k.startsWith(`member/${e}/`) && v?.code === code && v?.member)
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
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }), resolveRoleFor: async () => ({ kind: "none" }) }));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/received-email", () => ({ sendReceivedEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/invite-email", () => ({ sendInviteEmail: async () => ({ sent: true }), inviteUrl: (t: string) => `https://t/invite/${t}` }));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "bridge-it", LEAD = "lead@example.com", FRIEND = "friend@example.com";
const post = async (b: any) => {
  const res = (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;
  return { status: res.status, body: await res.json() };
};
const create = (email: string, name: string) =>
  post({ action: "create", eventId: EV, email, name, leadName: "Lead Person", phone: "9876543210", college: "RUAS" });

beforeEach(() => store.clear());

describe("a lead's team over an afternoon", () => {
  it("refuses to let the lead leave until they hand the team over", async () => {
    const a = await create(LEAD, "Bolt");
    const leave = await post({ action: "leave", eventId: EV, email: LEAD, code: a.body.code });
    expect(leave.status).toBe(409);
    expect(leave.body.error).toBe("You're the team lead. Hand the team to a teammate first, then you can leave.");
  });

  it("create → delete → create a different team works, and the new one is what `mine` returns", async () => {
    const a = await create(LEAD, "Bolt");
    expect(a.status).toBe(200);
    expect(a.body.created).toBe(true);

    const del = await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    expect(del.status).toBe(200);

    const b = await create(LEAD, "Volt");
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body.created).toBe(true);
    expect(b.body.name).toBe("Volt");
    expect(b.body.code).not.toBe(a.body.code);

    const mine = await post({ action: "mine", eventId: EV, email: LEAD });
    expect(mine.status).toBe(200);
    expect(mine.body?.name ?? mine.body?.team?.name).toBe("Volt");
  });

  it("create → delete → `mine` says there is no team", async () => {
    const a = await create(LEAD, "Bolt");
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const mine = await post({ action: "mine", eventId: EV, email: LEAD });
    expect(mine.status === 404 || mine.body === null || mine.body?.team === null || mine.body?.code === undefined, JSON.stringify(mine)).toBe(true);
  });

  it("create → delete → join a friend's team waits until that registration is withdrawn", async () => {
    /* Creating the team files the lead's own registration. Deleting the team
       does not throw that row away, so joining elsewhere is the same refusal
       a lead who already paid would get. */
    const a = await create(LEAD, "Bolt");
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const f = await create(FRIEND, "Amp");
    const blocked = await post({ action: "join", eventId: EV, email: LEAD, code: f.body.code, name: "Lead Person", phone: "9876543210", college: "RUAS" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/withdraw/i);
    store.get(`app/${EV}/${LEAD}.json`).status = "cancelled";
    const join = await post({ action: "join", eventId: EV, email: LEAD, code: f.body.code, name: "Lead Person", phone: "9876543210", college: "RUAS" });
    expect(join.status, JSON.stringify(join.body)).toBe(200);
  });

  it("creating again with the SAME name after deleting is fine too", async () => {
    const a = await create(LEAD, "Bolt");
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const b = await create(LEAD, "Bolt");
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body.created).toBe(true);
  });

  it("a friend cannot join the deleted team's code", async () => {
    const a = await create(LEAD, "Bolt");
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const join = await post({ action: "join", eventId: EV, email: FRIEND, code: a.body.code, name: "Friend", phone: "9876543211", college: "RUAS" });
    expect(join.status).toBe(404);
  });

  it("a lead who registered with team A, deleted it, can create team B — and the registration moves with them", async () => {
    const a = await create(LEAD, "Bolt");
    store.set(`app/${EV}/${LEAD}.json`, {
      ticketId: "PRV-1", eventId: EV, email: LEAD, name: "Lead Person", status: "pending", payment: "awaiting",
      paymentRef: null, teamName: "Bolt", teamCode: a.body.code, appliedAt: new Date().toISOString(),
    });
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const b = await create(LEAD, "Volt");
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    const app = store.get(`app/${EV}/${LEAD}.json`);
    expect(app.teamCode).toBe(b.body.code);
    expect(app.teamName).toBe("Volt");
    expect(app.status).toBe("pending");
  });

  it("a lead who registered with team A and deleted it cannot join elsewhere while that registration lives — and is told why", async () => {
    const a = await create(LEAD, "Bolt");
    store.set(`app/${EV}/${LEAD}.json`, {
      ticketId: "PRV-1", eventId: EV, email: LEAD, status: "pending", payment: "awaiting", paymentRef: null,
      teamName: "Bolt", teamCode: a.body.code, appliedAt: new Date().toISOString(),
    });
    await post({ action: "delete", eventId: EV, code: a.body.code, email: LEAD });
    const f = await create(FRIEND, "Amp");
    const join = await post({ action: "join", eventId: EV, email: LEAD, code: f.body.code, name: "Lead Person", phone: "9876543210", college: "RUAS" });
    expect(join.status).toBe(409);
    expect(join.body.error).toMatch(/withdraw/i);
  });

  it("a lead can add somebody whose previous team was deleted once that registration is withdrawn", async () => {
    const a = await create(FRIEND, "Amp");
    await post({ action: "delete", eventId: EV, code: a.body.code, email: FRIEND });
    const b = await create(LEAD, "Bolt");
    const blocked = await post({ action: "add_member", eventId: EV, email: LEAD, code: b.body.code, memberName: "Friend", memberEmail: FRIEND, memberPhone: "9876543211", college: "RUAS" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/already registered/i);
    store.get(`app/${EV}/${FRIEND}.json`).status = "cancelled";
    const add = await post({ action: "add_member", eventId: EV, email: LEAD, code: b.body.code, memberName: "Friend", memberEmail: FRIEND, memberPhone: "9876543211", college: "RUAS" });
    expect(add.status, JSON.stringify(add.body)).toBe(200);
  });

  it("somebody who left a team can join another", async () => {
    const a = await create(LEAD, "Bolt");
    const join1 = await post({ action: "join", eventId: EV, email: FRIEND, code: a.body.code, name: "Friend", phone: "9876543211", college: "RUAS" });
    expect(join1.status, JSON.stringify(join1.body)).toBe(200);
    const leave = await post({ action: "leave", eventId: EV, email: FRIEND, code: a.body.code });
    expect(leave.status, JSON.stringify(leave.body)).toBe(200);
    const other = await create("third@example.com", "Amp");
    const join2 = await post({ action: "join", eventId: EV, email: FRIEND, code: other.body.code, name: "Friend", phone: "9876543211", college: "RUAS" });
    expect(join2.status, JSON.stringify(join2.body)).toBe(200);
  });

  it("the same team name in two different events is two teams", async () => {
    const a = await create(LEAD, "Bolt");
    const b = await post({ action: "create", eventId: "robo-race", email: LEAD, name: "Bolt", leadName: "Lead Person", phone: "9876543210", college: "RUAS" });
    expect(a.status).toBe(200);
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body.code).not.toBe(a.body.code);
  });
});
