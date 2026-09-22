import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { ticketPayload } from "@/lib/ticket-qr";

/**
 * A ticket stops working the moment its holder stops being on the team.
 *
 * Two halves have to hold together for that to be true, and each is in a
 * different route. The lead removing somebody cancels their application; the
 * desk re-reads that application at the moment of the scan rather than
 * trusting the code in front of it. Either half alone would let a removed
 * teammate walk in on the QR already sitting in their inbox — a printed or
 * screenshotted ticket cannot be recalled, so the refusal has to happen at
 * the gate.
 */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
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
      .map(([, rec]) => rec.member),
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null, authRequired: () => false }));
vi.mock("@/lib/roles", async (o) => ({
  ...(await o<typeof import("@/lib/roles")>()),
  resolveRole: async () => ({ kind: "organiser" }),
  resolveRoleFor: async () => ({ kind: "none" }),
}));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => true,
}));
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://x/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));

let teams: typeof import("@/app/api/teams/route").POST;
let checkin: typeof import("@/app/api/checkin/route").POST;
beforeAll(async () => {
  ({ POST: teams } = await import("@/app/api/teams/route"));
  ({ POST: checkin } = await import("@/app/api/checkin/route"));
});

const EV = "robo-race", CODE = "TEAMCCCC3333";
const LEAD = "lead@example.com", MATE = "mate@example.com";
const TICKET = "PRV-AAAA1111BBBB2222";
const AT = "2026-09-20T06:00:00.000Z";

const scan = async () =>
  (await checkin(new Request("http://t/api/checkin", {
    method: "POST",
    body: JSON.stringify({ payload: ticketPayload({ ticketId: TICKET, eventId: EV, email: MATE }), eventId: EV }),
  }))) as Response;

const remove = async (by = LEAD) =>
  (await teams(new Request("http://t/api/teams", {
    method: "POST",
    body: JSON.stringify({ action: "remove_member", eventId: EV, code: CODE, email: by, memberEmail: MATE }),
  }))) as Response;

/** A confirmed team of two, both holding a ticket. */
function seed() {
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  for (const [email, name] of [[LEAD, "Asha Rao"], [MATE, "Ravi Kumar"]] as const) {
    store.set(`member/${EV}/${email}.json`, {
      code: CODE, eventId: EV,
      member: { name, email, phone: "9876543210", college: "RUAS", joinedAt: AT },
    });
    store.set(`app/${EV}/${email}.json`, {
      ticketId: email === MATE ? TICKET : "PRV-LEAD", eventId: EV, eventName: "ROBO RACE",
      status: "confirmed", payment: email === MATE ? "not_required" : "paid",
      fee: "Rs. 200/-", name, email, phone: "9876543210", college: "RUAS",
      teamName: "Bolt", teamCode: CODE, appliedAt: AT,
    });
  }
}

beforeEach(() => store.clear());

describe("a teammate's ticket after they leave the team", () => {
  it("admits them while they are still on it", async () => {
    seed();
    const res = await scan();
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Ravi Kumar");
  });

  it("refuses the same QR once the lead has removed them", async () => {
    seed();
    expect((await remove()).status).toBe(200);
    const res = await scan();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/cancelled, not confirmed/i);
  });

  it("cancels the application rather than leaving it holding a place", async () => {
    seed();
    await remove();
    const row = store.get(`app/${EV}/${MATE}.json`);
    expect(row.status).toBe("cancelled");
    expect(row.cancelledAt).toBeTruthy();
  });

  /* Already through the gate, then taken off the roster: the ticket still
     stops working, so they cannot pass it to somebody else at the door. */
  it("refuses a ticket that had already been scanned in", async () => {
    seed();
    await scan();
    expect(store.get(`app/${EV}/${MATE}.json`).checkedInAt).toBeTruthy();
    await remove();
    expect((await scan()).status).toBe(409);
  });

  it("does the same when they leave of their own accord", async () => {
    seed();
    const res = await teams(new Request("http://t/api/teams", {
      method: "POST",
      body: JSON.stringify({ action: "leave", eventId: EV, code: CODE, email: MATE }),
    })) as Response;
    expect(res.status).toBe(200);
    expect((await scan()).status).toBe(409);
  });

  it("leaves the rest of the team admitted", async () => {
    seed();
    await remove();
    expect(store.get(`app/${EV}/${LEAD}.json`).status).toBe("confirmed");
  });
});
