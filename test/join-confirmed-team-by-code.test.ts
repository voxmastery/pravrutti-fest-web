import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Joining an already-approved team with its code.
 *
 * A lead who registers, pays and gets confirmed before their team is full
 * then hands out the team code. The teammate who types it in was landing
 * "In review" — and staying there, because the organiser has already taken
 * the decision about that team and is never going to press Approve on it a
 * second time. The invite-link path learned to inherit the decision; this
 * one never did, so the same student got a different answer depending on
 * which way their lead added them.
 *
 * The fee is the lead's one Rs. 200 and a later member adds nothing to it,
 * so there is nothing left to decide: the team was approved, and they are
 * on the team.
 */

const store = new Map<string, any>();
const mailed: string[] = [];
const mail = vi.hoisted(() => ({ result: { sent: true } as { sent: boolean; error?: string } }));

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
    /* BRIDGE IT is closed on the live list. This file is about joining. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "bridge-it" ? { ...e, full: false } : e,
    ),
  };
});
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return mail.result; },
}));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "bridge-it", CODE = "TEAMAAAA1111";
const LEAD = "lead@example.com", MATE = "mate@example.com";
const AT = "2026-09-20T06:00:00.000Z";

const join = async (): Promise<Response> =>
  (await POST(new Request("http://t/api/teams", {
    method: "POST",
    body: JSON.stringify({
      action: "join", eventId: EV, code: CODE,
      email: MATE, name: "Ravi Kumar", phone: "9876543211", college: "RUAS",
    }),
  }))) as Response;

const app = () => store.get(`app/${EV}/${MATE}.json`);

/** A team whose lead sits at `leadStatus`. */
function seed(leadStatus: "pending" | "confirmed" | "cancelled") {
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "BRIDGE IT",
    status: leadStatus, payment: leadStatus === "confirmed" ? "paid" : "awaiting",
    fee: "Rs. 200/-", name: "Asha Rao", email: LEAD, phone: "9876543210", college: "RUAS",
    teamName: "Bolt", teamCode: CODE, appliedAt: AT,
  });
}

beforeEach(() => { store.clear(); mailed.length = 0; mail.result = { sent: true }; });

describe("joining a confirmed team with its code", () => {
  it("inherits the decision instead of parking them in review", async () => {
    seed("confirmed");
    expect((await join()).status).toBe(200);
    expect(app().status).toBe("confirmed");
    expect(app().decidedAt).toBeTruthy();
  });

  /* The team's Rs. 200 is the lead's and stays the lead's. */
  it("records nothing as collected from them", async () => {
    seed("confirmed");
    await join();
    expect(app().payment).toBe("not_required");
    expect(app().fee).toMatch(/lead/i);
    expect(app().paymentVerifiedAt).toBeUndefined();
    expect(app().paymentRef ?? null).toBeNull();
  });

  it("sends them the ticket and stamps the send on the row", async () => {
    seed("confirmed");
    await join();
    expect(mailed).toEqual([MATE]);
    expect(app().confirmationEmailAt).toBeTruthy();
    expect(app().confirmationEmailError).toBeNull();
  });

  /* The mailbox is throttled; a refusal must leave a trace, or they are a
     confirmed student nobody knows has not been told. */
  it("keeps the place and records the error when the mail is refused", async () => {
    seed("confirmed");
    mail.result = { sent: false, error: '451 4.7.1 Ratelimit "hostinger_out_ratelimit" exceeded' };
    await join();
    expect(app().status).toBe("confirmed");
    expect(app().confirmationEmailAt ?? null).toBeNull();
    expect(app().confirmationEmailError).toMatch(/Ratelimit/);
  });
});

describe("joining a team that has not been approved", () => {
  it("waits in review alongside the lead", async () => {
    seed("pending");
    await join();
    expect(app().status).toBe("pending");
    expect(app().decidedAt).toBeUndefined();
    expect(mailed).toEqual([]);
  });

  it("stays in review when the lead has not registered at all", async () => {
    seed("pending");
    store.delete(`app/${EV}/${LEAD}.json`);
    await join();
    expect(app().status).toBe("pending");
    expect(mailed).toEqual([]);
  });

  it("never inherits from a lead who withdrew", async () => {
    seed("cancelled");
    await join();
    expect(app().status).toBe("pending");
    expect(mailed).toEqual([]);
  });
});
