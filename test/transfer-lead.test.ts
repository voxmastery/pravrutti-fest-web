import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * A lead handing the team to a teammate.
 *
 * Leads had no way to do it: no "make lead", and the lead can't leave or be
 * removed — so a team whose lead couldn't come, or where the wrong person
 * had registered first, had to ask the organisers. Robo Drift did, on 6 Oct.
 *
 * The organisers' rule (6 Oct 2026): a lead can hand over at any time. The
 * new lead manages the team from then on. The payment stays recorded against
 * whoever made it; only if the lead hadn't paid yet does the duty to pay move
 * with the role. The old lead is an ordinary member afterwards — except that
 * while the payment they made is still being verified, it is what holds the
 * team's place, so they can't leave or be removed until it is.
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
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => who.email, authRequired: () => true }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }), resolveRoleFor: async () => ({ kind: "none" }) }));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/invite-email", () => ({ inviteUrl: (t: string) => `https://x/invite/${t}`, sendInviteEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/received-email", () => ({ sendReceivedEmail: async () => ({ sent: true }) }));

let teams: typeof import("@/app/api/teams/route");
let register: typeof import("@/app/api/register/route");
beforeAll(async () => {
  teams = await import("@/app/api/teams/route");
  register = await import("@/app/api/register/route");
});

const EV = "robo-race", CODE = "ROBODRIFT001";
const POOJA = "pooja@x.com", KUSH = "kush@x.com", DHANUSH = "dhanush@x.com";
const AT = "2026-10-05T10:58:00.000Z";

const post = async (body: Record<string, unknown>) => {
  const res = (await teams.POST(new Request("http://t/api/teams", {
    method: "POST", body: JSON.stringify({ eventId: EV, code: CODE, ...body }),
  }))) as Response;
  return { status: res.status, body: await res.json() };
};
const handOver = (to = KUSH) => post({ action: "transfer_lead", memberEmail: to });
const app = (email: string) => store.get(`app/${EV}/${email}.json`);
const team = () => store.get(`team/${EV}/${CODE}.json`);
const row = (email: string, over: Record<string, unknown>) =>
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-" + email[0].toUpperCase(), eventId: EV, eventName: "ROBO RACE", status: "pending",
    payment: "not_required", fee: "Covered by team lead", name: email.split("@")[0], email,
    phone: "9000000000", college: "RUAS", teamName: "Robo Drift", teamCode: CODE, members: null, appliedAt: AT, ...over,
  });
const onRoster = (email: string) =>
  store.set(`member/${EV}/${email}.json`, { code: CODE, eventId: EV, member: { name: email.split("@")[0], email, phone: "9000000000", college: "RUAS", joinedAt: AT } });

beforeEach(() => {
  store.clear();
  who.email = POOJA;
  store.set(`team/${EV}/${CODE}.json`, { code: CODE, eventId: EV, name: "Robo Drift", bio: "", createdByEmail: POOJA, members: [], createdAt: AT });
  for (const e of [POOJA, KUSH, DHANUSH]) onRoster(e);
  /* Pooja paid; the payment is in review. */
  row(POOJA, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "TMHKSWOQJC4TBCO" });
  row(KUSH, {});
  row(DHANUSH, {});
});

describe("handing the lead to a teammate", () => {
  it("makes them the lead", async () => {
    expect((await handOver()).status).toBe(200);
    expect(team().createdByEmail).toBe(KUSH);
    expect(team().previousLead).toBe(POOJA);
  });

  it("leaves the payment against the person who made it", async () => {
    await handOver();
    expect(app(POOJA)).toMatchObject({ payment: "awaiting", fee: "Rs. 200/-", paymentRef: "TMHKSWOQJC4TBCO" });
    expect(app(KUSH)).toMatchObject({ payment: "not_required", fee: "Covered by team lead" });
  });

  it("moves the duty to pay when the lead hadn't paid", async () => {
    row(POOJA, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: null, stage: "intent" });
    await handOver();
    expect(app(KUSH)).toMatchObject({ payment: "awaiting", fee: "Rs. 200/-", paymentRef: null, stage: "intent" });
    expect(app(POOJA)).toMatchObject({ payment: "not_required", fee: "Covered by team lead" });
    expect(app(POOJA).stage).toBeUndefined();
  });

  it("hands over a confirmed team, payment and all staying put", async () => {
    row(POOJA, { status: "confirmed", payment: "paid", fee: "Rs. 200/-", paymentRef: "TMHKSWOQJC4TBCO" });
    row(KUSH, { status: "confirmed" });
    await handOver();
    expect(team().createdByEmail).toBe(KUSH);
    expect(app(POOJA)).toMatchObject({ status: "confirmed", payment: "paid" });
  });

  it("lets the new lead manage the team, and not the old one", async () => {
    await handOver();
    who.email = KUSH;
    const res = (await teams.GET(new Request(`http://t/api/teams?event=${EV}&mine=1`))) as Response;
    const mine = (await res.json()).team;
    expect(mine.isLead).toBe(true);
    who.email = POOJA;
    expect((await post({ action: "remove_member", memberEmail: DHANUSH })).status).toBe(403);
  });

  it("is only the lead's to give", async () => {
    who.email = DHANUSH;
    expect((await handOver()).status).toBe(403);
    expect(team().createdByEmail).toBe(POOJA);
  });

  it("goes only to someone registered on the team", async () => {
    expect((await handOver("stranger@x.com")).status).toBe(409);
    row(KUSH, { status: "cancelled" });
    expect((await handOver()).status).toBe(409);
    expect(team().createdByEmail).toBe(POOJA);
  });

  it("refuses handing it to yourself", async () => {
    expect((await handOver(POOJA)).status).toBe(409);
  });
});

describe("the old lead, whose payment holds the place", () => {
  it("can't leave while that payment is being verified", async () => {
    await handOver();
    who.email = POOJA;
    const res = await post({ action: "leave" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/payment/i);
    expect(app(POOJA).status).toBe("pending");
  });

  it("can't be removed by the new lead while it is", async () => {
    await handOver();
    who.email = KUSH;
    expect((await post({ action: "remove_member", memberEmail: POOJA })).status).toBe(409);
  });

  it("can't withdraw from My Tickets either, while teammates are on the team", async () => {
    await handOver();
    who.email = POOJA;
    const res = await register.DELETE(new Request("http://t/api/register", {
      method: "DELETE", body: JSON.stringify({ eventId: EV }),
    }));
    expect(res.status).toBe(409);
    expect(app(POOJA).status).toBe("pending");
  });

  it("can be removed once the team is confirmed", async () => {
    row(POOJA, { status: "confirmed", payment: "paid", fee: "Rs. 200/-", paymentRef: "TMHKSWOQJC4TBCO" });
    row(KUSH, { status: "confirmed" });
    await handOver();
    who.email = KUSH;
    expect((await post({ action: "remove_member", memberEmail: POOJA })).status).toBe(200);
  });
});
