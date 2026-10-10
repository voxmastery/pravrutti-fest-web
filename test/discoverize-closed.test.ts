import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  events, eventId, festFor, registrationState, listedEvents,
} from "@/lib/pravrutti-data";
import { isFull } from "@/lib/event-full";
import { discoverizeState, mayPay } from "@/lib/discoverize";

/**
 * Discoverize closed again on 8 Oct 2026, 7:00 AM IST. New sign-ups stop.
 * A team already in does not: the shortlist desk still names who presents,
 * a shortlisted lead still attaches the ₹200 JUNO reference, and verifying
 * that payment still confirms them. A shortlisted lead who registered solo
 * may still create their team and add teammates, up to four. Anyone who is
 * not shortlisted still cannot.
 *
 * The clock is pinned after the event's own close and before the fest-wide
 * date, so a fest that is still open cannot quietly reopen Discoverize.
 */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null }));
const role = vi.hoisted(() => ({ value: { kind: "none" } as any }));
const clock = vi.hoisted(() => ({ now: Date.parse("2026-10-08T06:00:00.000Z") }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix = "") =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
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
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([path, rec]) => path.startsWith(`member/${eventId}/`) && rec?.code === code && rec?.member)
      .map(([, rec]) => rec.member),
}));
vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => identity.email,
  authRequired: () => false,
}));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => role.value,
  resolveRoleFor: async () => ({ kind: "none" }),
  canViewEvent: (r: any, ev: string) =>
    r.kind === "organiser" || (r.kind === "coordinator" && r.eventIds?.includes(ev)),
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
vi.mock("@/lib/received-email", () => ({ sendReceivedEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://pravrutti.tech/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));

let REGISTER: typeof import("@/app/api/register/route").POST;
let TEAMS: typeof import("@/app/api/teams/route").POST;
let DESK: typeof import("@/app/api/dashboard/discoverize/route").POST;
let verifyPayment: typeof import("@/lib/payment-review").verifyPayment;

beforeAll(async () => {
  ({ POST: REGISTER } = await import("@/app/api/register/route"));
  ({ POST: TEAMS } = await import("@/app/api/teams/route"));
  ({ POST: DESK } = await import("@/app/api/dashboard/discoverize/route"));
  ({ verifyPayment } = await import("@/lib/payment-review"));
});

const EV = "discoverize-research-paper-presentation";
const AFTER = Date.parse("2026-10-08T06:00:00.000Z");
const LISTED = "nayanasree1906@gmail.com";
const REF = "JIDCWIOOPNU1QEV";

const postRegister = async (b: unknown) =>
  (await REGISTER(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;
const postTeams = async (b: unknown) =>
  (await TEAMS(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;
const postDesk = async (b: unknown) =>
  (await DESK(new Request("http://t/api/dashboard/discoverize", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b),
  }))) as Response;

const fresh = (email: string, over: Record<string, unknown> = {}) => ({
  name: "A Student", email, phone: "9876543210", college: "RUAS", eventId: EV, ...over,
});

function seedRow(email: string, over: Record<string, unknown> = {}) {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-D", eventId: EV, eventName: "Discoverize (Research Paper Presentation)",
    status: "pending", payment: "not_required", fee: "Free",
    name: "Listed Lead", email, phone: "9876543210", college: "RUAS",
    teamName: null, teamCode: null, paymentRef: null, appliedAt: "2026-10-01T09:00:00.000Z",
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  identity.email = null;
  role.value = { kind: "none" };
  clock.now = AFTER;
});

describe("Discoverize registrations are closed", () => {
  const event = events.find((e) => eventId(e.name) === EV)!;

  it("closed at 7:00 AM IST on 8 Oct, and is not marked full", () => {
    expect(event.registrationCloses).toBe("2026-10-08T01:30:00.000Z");
    expect(registrationState(AFTER, festFor(event))).toBe("closed");
    expect(event.full).toBeFalsy();
    expect(isFull(event, { people: 0, teams: 0 })).toBe(false);
    expect(listedEvents).toContain(event);
  });

  it("refuses a new sign-up", async () => {
    const res = await postRegister(fresh("new@example.com"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Discoverize.*closed/i);
    expect(store.has(`app/${EV}/new@example.com.json`)).toBe(false);
  });

  it("refuses someone whose earlier registration was cancelled", async () => {
    seedRow("back@example.com", { status: "cancelled" });
    const res = await postRegister(fresh("back@example.com"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/closed/i);
  });

  it("refuses a new team and joining one with a code", async () => {
    const created = await postTeams({
      action: "create", eventId: EV, email: "new@example.com", name: "Late Team", bio: "",
      leadName: "New Lead", phone: "9876543210", college: "RUAS",
    });
    expect(created.status).toBe(409);
    expect((await created.json()).error).toMatch(/closed/i);

    store.set(`team/${EV}/LATE0001.json`, {
      code: "LATE0001", eventId: EV, name: "Already In", createdByEmail: LISTED, members: [], createdAt: "x",
    });
    const joined = await postTeams({
      action: "join", eventId: EV, code: "LATE0001", email: "joiner@example.com",
      name: "A Joiner", phone: "9876543212", college: "RUAS",
    });
    expect(joined.status).toBe(409);
    expect((await joined.json()).error).toMatch(/closed/i);
  });
});

describe("closing the door does not stop a shortlisted team paying", () => {
  it("takes a JUNO reference from a lead on the coordinators' list", async () => {
    seedRow(LISTED);
    const res = await postRegister({ stage: "reference", eventId: EV, email: LISTED, paymentRef: REF });
    expect(res.status).toBe(200);
    const saved = store.get(`app/${EV}/${LISTED}.json`);
    expect(saved.payment).toBe("awaiting");
    expect(saved.fee).toBe("Rs. 200/-");
    expect(saved.paymentRef).toBe(REF);
    expect(saved.status).toBe("pending");
    expect(saved.round.shortlistedAt).toBeTruthy();
    expect(saved.round.paymentSubmittedAt).toBeTruthy();
    expect(discoverizeState(saved)).toBe("payment_submitted");
    expect(mayPay(saved)).toBe(true);
  });

  it("still lets the shortlist desk name a team", async () => {
    const lead = "payer@example.com";
    const code = "DISC0002";
    store.set(`team/${EV}/${code}.json`, {
      code, eventId: EV, name: "Cosmiks", createdByEmail: lead, members: [], createdAt: "x",
    });
    seedRow(lead, { teamName: "Cosmiks", teamCode: code });
    role.value = { kind: "coordinator", eventIds: [EV] };
    identity.email = "aaliyahaijaz2006@gmail.com";
    const res = await postDesk({ action: "shortlist", code });
    expect(res.status).toBe(200);
    const saved = store.get(`app/${EV}/${lead}.json`);
    expect(saved.round.shortlistedAt).toBeTruthy();
    expect(saved.payment).toBe("awaiting");
    expect(saved.fee).toBe("Rs. 200/-");
    expect(discoverizeState(saved)).toBe("payment_pending");
  });

  it("still confirms a shortlisted team when the payment is verified", async () => {
    const lead = "payer@example.com";
    seedRow(lead, {
      payment: "awaiting", fee: "Rs. 200/-", paymentRef: REF,
      round: { shortlistedAt: "2026-10-08T04:00:00.000Z", shortlistedBy: "admin", paymentSubmittedAt: "2026-10-08T05:00:00.000Z" },
    });
    const out = await verifyPayment({ eventId: EV, email: lead, by: "organiser@example.com" });
    expect(out?.application.status).toBe("confirmed");
    expect(out?.application.payment).toBe("paid");
    expect(discoverizeState(out!.application)).toBe("final_round_confirmed");
  });

  it("keeps the Pay button for a registered shortlisted lead, and the closed label for everyone else", () => {
    const panel = readFileSync(fileURLToPath(new URL("../components/event-register-panel.tsx", import.meta.url)), "utf8");
    const pay = panel.slice(panel.indexOf("const showPayRound"));
    expect(pay.slice(0, pay.indexOf(";"))).not.toMatch(/\bclosed\b/);
    expect(panel).toContain("const showClosed = viewerReady && !live && closed");
    const route = readFileSync(fileURLToPath(new URL("../app/api/register/route.ts", import.meta.url)), "utf8");
    const reference = route.indexOf('body?.stage === "reference"');
    const windowCheck = route.indexOf("effectiveRegistrationOpen(undefined, festFor(event))");
    expect(reference).toBeGreaterThan(0);
    expect(windowCheck).toBeGreaterThan(reference);
  });
});

describe("a shortlisted Discoverize lead can still form a team", () => {
  const create = (email: string, name = "Paper Trail") =>
    postTeams({ action: "create", eventId: EV, email, name });

  const add = (email: string, code: string, memberEmail: string, memberName: string) =>
    postTeams({
      action: "add_member", eventId: EV, code, email,
      memberName, memberEmail, memberPhone: "9876543211",
    });

  it("lets a listed solo create a team from their registration, without a second entry", async () => {
    seedRow(LISTED, { name: "Nayanasree" });
    const res = await create(LISTED);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.memberCount).toBe(1);
    expect(body.maxMembers).toBe(4);
    const saved = store.get(`app/${EV}/${LISTED}.json`);
    expect(saved.teamCode).toBe(body.code);
    expect(saved.teamName).toBe("Paper Trail");
    expect(saved.status).toBe("pending");
    expect(saved.payment).toBe("not_required");
    expect(saved.fee).toBe("Free");
    expect(store.get(`member/${EV}/${LISTED}.json`).code).toBe(body.code);
  });

  it("lets that lead add teammates up to four, and refuses a fifth", async () => {
    seedRow(LISTED, { name: "Nayanasree" });
    const created = await (await create(LISTED)).json();
    const mates = [
      ["a@example.com", "Asha Rao"],
      ["b@example.com", "Bhavya N"],
      ["c@example.com", "Chitra K"],
    ] as const;
    for (const [memberEmail, memberName] of mates) {
      const res = await add(LISTED, created.code, memberEmail, memberName);
      expect(res.status).toBe(200);
    }
    const full = await add(LISTED, created.code, "d@example.com", "Deepa S");
    expect(full.status).toBe(409);
    expect((await full.json()).error).toMatch(/full/i);
    expect(store.has(`app/${EV}/d@example.com.json`)).toBe(false);

    const mine = await postTeams({ action: "mine", eventId: EV, email: LISTED });
    expect(mine.status).toBe(200);
    expect((await mine.json()).team.canInvite).toBe(true);
  });

  it("lets a lead the desk shortlisted, who is not on the hardcoded list, create too", async () => {
    const lead = "payer@example.com";
    seedRow(lead, {
      round: { shortlistedAt: "2026-10-08T04:00:00.000Z", shortlistedBy: "desk" },
    });
    const res = await create(lead, "Desk Team");
    expect(res.status).toBe(200);
    expect(store.get(`app/${EV}/${lead}.json`).teamName).toBe("Desk Team");
  });

  it("lets a shortlisted lead whose team was deleted make another", async () => {
    const code = "GONE0001";
    store.set(`team/${EV}/${code}.json`, {
      code, eventId: EV, name: "Old", createdByEmail: LISTED, members: [], createdAt: "x",
      deletedAt: "2026-10-08T02:00:00.000Z",
    });
    seedRow(LISTED, { teamName: "Old", teamCode: code });
    const res = await create(LISTED, "New Name");
    expect(res.status).toBe(200);
    expect(store.get(`app/${EV}/${LISTED}.json`).teamName).toBe("New Name");
    expect(store.get(`app/${EV}/${LISTED}.json`).teamCode).not.toBe(code);
  });

  it("refuses a Discoverize registration that was not shortlisted", async () => {
    seedRow("waiting@example.com");
    const res = await create("waiting@example.com", "Too Soon");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/closed/i);
    expect(store.get(`app/${EV}/waiting@example.com.json`).teamCode).toBeNull();
  });

  it("refuses a shortlisted lead who already has a team, and a code join", async () => {
    const code = "HAVE0001";
    store.set(`team/${EV}/${code}.json`, {
      code, eventId: EV, name: "Already", createdByEmail: LISTED, members: [], createdAt: "x",
    });
    store.set(`member/${EV}/${LISTED}.json`, {
      code, eventId: EV,
      member: { name: "Nayanasree", email: LISTED, phone: "9876543210", college: "RUAS", joinedAt: "x" },
    });
    seedRow(LISTED, { teamName: "Already", teamCode: code });
    const again = await create(LISTED, "Second");
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/closed/i);
    expect(store.get(`app/${EV}/${LISTED}.json`).teamCode).toBe(code);

    const joined = await postTeams({
      action: "join", eventId: EV, code, email: "joiner@example.com",
      name: "A Joiner", phone: "9876543212", college: "RUAS",
    });
    expect(joined.status).toBe(409);
    expect((await joined.json()).error).toMatch(/closed/i);
    expect(store.has(`app/${EV}/joiner@example.com.json`)).toBe(false);
  });
});
