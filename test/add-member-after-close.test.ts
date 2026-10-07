import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { eventId } from "@/lib/pravrutti-data";
import { leadMayInvite } from "@/lib/lead-decision";

/**
 * Hacktivate closed at 11:59 PM IST on 1 October. Teams already in — the
 * lead holds a live registration, in review or confirmed — still had empty
 * seats, and no way to fill them: add_member refused because the window
 * had closed.
 *
 * Closing the window still stops a new team and still stops someone joining
 * with a code. It does not stop that lead from adding a teammate. A full
 * roster, a person who is not the lead, and a duplicate email still refuse.
 *
 * The clock is pinned. The real registration dates decide, so a fest-wide
 * extension cannot quietly reopen Hacktivate, and a later fest-wide close
 * cannot quietly freeze a team that is already in.
 */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null }));
const clock = vi.hoisted(() => ({ now: Date.parse("2026-10-07T06:00:00.000Z") }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix = "") =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((url) => ({ url })),
  readPrivate: async (url: string) => store.get(url) ?? null,
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
vi.mock("@/lib/pravrutti-data", async (orig) => {
  const actual = await orig<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    effectiveRegistrationOpen: (
      now?: number,
      fest?: { registrationCloses: string | null; registrationOpens: string | null },
    ) => actual.effectiveRegistrationOpen(now ?? clock.now, fest),
  };
});
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://pravrutti.tech/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));

let POST: typeof import("@/app/api/teams/route").POST;
let GET: typeof import("@/app/api/teams/route").GET;
beforeAll(async () => { ({ POST, GET } = await import("@/app/api/teams/route")); });

const EV = eventId("Hacktivate");
const CODE = "HACKTIVATE01";
const LEAD = "rayhaan@example.com";
const MATE = "prithvin@example.com";
const AFTER_HACKTIVATE = Date.parse("2026-10-07T06:00:00.000Z"); // 7 Oct, fest still open
const AFTER_FEST = Date.parse("2026-10-10T06:00:00.000Z"); // 10 Oct, fest closed too

const post = async (b: any): Promise<Response> =>
  (await POST(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;

const mine = async (): Promise<Response> =>
  (await GET(new Request(`http://t/api/teams?event=${EV}&mine=1`))) as Response;

function member(email: string, name: string, at: string) {
  store.set(`member/${EV}/${email}.json`, {
    code: CODE, eventId: EV,
    member: { name, email, phone: "9876543210", college: "RUAS", joinedAt: at },
  });
}

/** A Hacktivate team whose lead is already confirmed. */
function seedConfirmed(extra: { email: string; name: string }[] = []) {
  const at = "2026-09-28T06:00:00.000Z";
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Code Riders", bio: "", createdByEmail: LEAD,
    members: [], createdAt: at,
  });
  member(LEAD, "Rayhaan Backer Shah", at);
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "Hacktivate", status: "confirmed", payment: "paid",
    fee: "Rs. 200/-", name: "Rayhaan Backer Shah", email: LEAD, phone: "9876543210",
    college: "RUAS", teamName: "Code Riders", teamCode: CODE, appliedAt: at,
  });
  extra.forEach((p, i) => member(p.email, p.name, `2026-09-28T0${i + 7}:00:00.000Z`));
}

const addMate = (over: Record<string, unknown> = {}) =>
  post({
    action: "add_member", eventId: EV, code: CODE, email: LEAD,
    memberName: "Prithvin Jothinathan", memberEmail: MATE, memberPhone: "9876543211", ...over,
  });

beforeEach(() => {
  store.clear();
  identity.email = null;
  clock.now = AFTER_HACKTIVATE;
});

describe("leadMayInvite", () => {
  it("allows an open window, and a closed one only when the lead is already in", () => {
    expect(leadMayInvite({ registrationOpen: true, leadRegistered: false })).toBe(true);
    expect(leadMayInvite({ registrationOpen: true, leadRegistered: true })).toBe(true);
    expect(leadMayInvite({ registrationOpen: false, leadRegistered: true })).toBe(true);
    expect(leadMayInvite({ registrationOpen: false, leadRegistered: false })).toBe(false);
  });
});

describe("Hacktivate after its own close", () => {
  it("lets a confirmed lead add a teammate", async () => {
    seedConfirmed();
    const res = await addMate();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team.memberCount).toBe(2);
    expect(store.get(`app/${EV}/${MATE}.json`).status).toBe("confirmed");
    expect(store.get(`member/${EV}/${MATE}.json`).code).toBe(CODE);
  });

  it("lets a lead who is still in review add a teammate", async () => {
    seedConfirmed();
    store.get(`app/${EV}/${LEAD}.json`).status = "pending";
    store.get(`app/${EV}/${LEAD}.json`).payment = "awaiting";
    expect((await addMate()).status).toBe(200);
    expect(store.get(`app/${EV}/${MATE}.json`).status).toBe("pending");
  });

  it("tells My Tickets that this lead can still invite", async () => {
    seedConfirmed();
    identity.email = LEAD;
    const body = await (await mine()).json();
    expect(body.team.isLead).toBe(true);
    expect(body.team.canInvite).toBe(true);
  });

  it("refuses a new team", async () => {
    const res = await post({
      action: "create", eventId: EV, email: LEAD, name: "Late Entry", bio: "",
      leadName: "Rayhaan Backer Shah", phone: "9876543210", college: "RUAS",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Hacktivate closed/i);
  });

  it("refuses joining with a code", async () => {
    seedConfirmed();
    const res = await post({
      action: "join", eventId: EV, code: CODE, email: "newcomer@example.com",
      name: "New Comer", phone: "9876543212", college: "RUAS",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Hacktivate closed/i);
  });

  it("refuses a lead who is no longer registered", async () => {
    seedConfirmed();
    store.get(`app/${EV}/${LEAD}.json`).status = "cancelled";
    const res = await addMate();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/closed/i);
  });

  it("refuses anyone who is not the lead", async () => {
    seedConfirmed();
    const res = await addMate({ email: MATE });
    expect(res.status).toBe(403);
  });

  it("refuses a duplicate and a full roster", async () => {
    seedConfirmed([{ email: MATE, name: "Prithvin Jothinathan" }]);
    const dup = await addMate();
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toMatch(/already on this team/i);

    store.clear();
    seedConfirmed([
      { email: "a@example.com", name: "Asha Rao" },
      { email: "b@example.com", name: "Bhavya N" },
      { email: "c@example.com", name: "Chitra K" },
    ]);
    const full = await addMate();
    expect(full.status).toBe(409);
    expect((await full.json()).error).toMatch(/full/i);
  });
});

describe("after the fest-wide close as well", () => {
  beforeEach(() => { clock.now = AFTER_FEST; });

  it("still lets a confirmed Hacktivate lead add a teammate", async () => {
    seedConfirmed();
    expect((await addMate()).status).toBe(200);
  });

  it("still refuses a new team", async () => {
    const res = await post({
      action: "create", eventId: EV, email: "late@example.com", name: "Too Late", bio: "",
      leadName: "Late Lead", phone: "9876543210", college: "RUAS",
    });
    expect(res.status).toBe(409);
  });
});
