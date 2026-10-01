import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * An invited teammate joining by code, on a team their own invite fills.
 *
 * A lead adds two teammates. Their invite emails bounce off the mail limit,
 * so the lead tells them to type the team code instead. But each unaccepted
 * invite already holds a place, so the team now reads 4 of 4 — and the join
 * form saw "full", greyed out its button and never asked the server, which
 * would have let them in. Nexovate's Manoj and Rishabh were locked out of
 * their own team that way.
 *
 * So the preview says when the person looking is already on the list, and a
 * full team still has room for exactly those people. A stranger still finds
 * it full.
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
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "hacktivate", CODE = "SH9LJRNK3Q34";
const LEAD = "npatwardhan17@gmail.com", JOINED = "rajeev@x.com";
const MANOJ = "manojava.n.rao@gmail.com", RISHABH = "rishabh2007.rai@gmail.com";
const AT = "2026-09-29T13:20:00.000Z";

const call = async (body: Record<string, unknown>) => {
  const res = (await POST(new Request("http://t/api/teams", {
    method: "POST", body: JSON.stringify(body),
  }))) as Response;
  return { status: res.status, body: await res.json() };
};
const verify = () => call({ action: "verify", eventId: EV, code: CODE });
const join = () => call({
  action: "join", eventId: EV, code: CODE,
  name: "Manoj Rao", phone: "9876543212", college: "RVCE",
});

beforeEach(() => {
  store.clear();
  who.email = null;
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Nexovate", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  const member = (email: string, extra: Record<string, unknown>) =>
    store.set(`member/${EV}/${email}.json`, { code: CODE, eventId: EV, member: { name: email, email, phone: "9800000000", college: "RVCE", ...extra } });
  member(LEAD, { joinedAt: AT });
  member(JOINED, { joinedAt: AT });
  /* The two the lead added. Their invite emails never arrived. */
  member(MANOJ, { invitedAt: AT, inviteToken: "a".repeat(64) });
  member(RISHABH, { invitedAt: AT, inviteToken: "b".repeat(64) });
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "Hacktivate", status: "confirmed", payment: "paid",
    fee: "Rs. 200/-", name: "Niranjan", email: LEAD, phone: "9800000000", college: "RVCE",
    teamName: "Nexovate", teamCode: CODE, appliedAt: AT,
  });
});

describe("what the code lookup tells the person looking", () => {
  it("shows the team as full, as it is", async () => {
    const res = await verify();
    expect(res.body.memberCount).toBe(4);
    expect(res.body.isFull).toBe(true);
  });

  it("tells an invited teammate there is a place for them", async () => {
    who.email = MANOJ;
    expect((await verify()).body.invited).toBe(true);
  });

  it("matches the invite whatever the case of the address", async () => {
    who.email = MANOJ.toUpperCase();
    expect((await verify()).body.invited).toBe(true);
  });

  it("tells a stranger nothing of the kind", async () => {
    who.email = "someone.else@gmail.com";
    expect((await verify()).body.invited).toBeFalsy();
  });

  it("says nothing about invites to someone not signed in", async () => {
    expect((await verify()).body.invited).toBeFalsy();
  });

  /* The lead is on their own roster, but there is nothing for them to join. */
  it("does not call the lead an invitee", async () => {
    who.email = LEAD;
    expect((await verify()).body.invited).toBeFalsy();
  });
});

describe("joining", () => {
  it("lets an invited teammate join the team their invite fills", async () => {
    who.email = MANOJ;
    const res = await join();
    expect(res.status).toBe(200);
    expect(store.get(`app/${EV}/${MANOJ}.json`)).toBeTruthy();
  });

  /* The team was already approved, so they come in confirmed. */
  it("brings them in confirmed behind an approved lead", async () => {
    who.email = MANOJ;
    await join();
    expect(store.get(`app/${EV}/${MANOJ}.json`).status).toBe("confirmed");
    expect(store.get(`app/${EV}/${MANOJ}.json`).payment).toBe("not_required");
  });

  it("still turns a stranger away from a full team", async () => {
    who.email = "someone.else@gmail.com";
    const res = await join();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
  });
});
