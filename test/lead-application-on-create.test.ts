import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COVERED_BY_LEAD } from "@/lib/applications";

/* A team used to exist with a lead membership and no application, whenever
   the creator never reached the payment form. The lead row is written with
   the team: in review, fee due, no receipt, and no mail. Paying later
   completes that row. Discoverize still attaches the registration they
   already have. */

const store = new Map<string, any>();
const mailed = vi.hoisted(() => ({ confirmation: 0, received: 0 }));

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
vi.mock("@/lib/pravrutti-data", async (o) => {
  const actual = await o<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    effectiveRegistrationOpen: () => true,
    /* BRIDGE IT is closed on the live list. This file is about the lead row. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "bridge-it" ? { ...e, full: false } : e,
    ),
  };
});
vi.mock("@/lib/received-email", () => ({
  sendReceivedEmail: async () => {
    mailed.received += 1;
    return { sent: true };
  },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async () => {
    mailed.confirmation += 1;
    return { sent: true };
  },
}));
vi.mock("@/lib/invite-email", () => ({
  sendInviteEmail: async () => ({ sent: true }),
  inviteUrl: (t: string) => `https://t/invite/${t}`,
}));

let teamsPost: typeof import("@/app/api/teams/route").POST;
let registerPost: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST: teamsPost } = await import("@/app/api/teams/route"));
  ({ POST: registerPost } = await import("@/app/api/register/route"));
});

const EV = "bridge-it";
const LEAD = "lead@example.com";
const MATE = "mate@example.com";

const postTeam = async (b: any) => {
  const res = (await teamsPost(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }))) as Response;
  return { status: res.status, body: await res.json() };
};
const postRegister = async (b: any) => {
  const res = (await registerPost(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }))) as Response;
  return { status: res.status, body: await res.json() };
};

const create = (email = LEAD, name = "Bolt") =>
  postTeam({
    action: "create", eventId: EV, email, name,
    leadName: "Lead Person", phone: "9876543210", college: "RUAS",
  });

beforeEach(() => {
  store.clear();
  mailed.confirmation = 0;
  mailed.received = 0;
});

describe("creating a team files the lead's unpaid registration", () => {
  it("writes a pending, awaiting, fee-due row and sends nothing", async () => {
    const a = await create();
    expect(a.status).toBe(200);
    expect(a.body.created).toBe(true);
    const app = store.get(`app/${EV}/${LEAD}.json`);
    expect(app).toMatchObject({
      status: "pending",
      payment: "awaiting",
      fee: "Rs. 200/-",
      paymentRef: null,
      stage: "intent",
      name: "Lead Person",
      email: LEAD,
      phone: "9876543210",
      college: "RUAS",
      teamName: "Bolt",
      teamCode: a.body.code,
      eventId: EV,
    });
    expect(app.ticketId).toMatch(/^PRV-/);
    expect(app.confirmationEmailAt).toBeUndefined();
    expect(app.receivedEmailAt).toBeUndefined();
    expect(mailed.confirmation).toBe(0);
    expect(mailed.received).toBe(0);
  });

  it("lets the pay-return complete that row instead of refusing a duplicate", async () => {
    const a = await create();
    const ticket = store.get(`app/${EV}/${LEAD}.json`).ticketId;
    const done = await postRegister({
      name: "Lead Person", email: LEAD, phone: "9876543210", college: "RUAS",
      eventId: EV, teamCode: a.body.code, teamName: "Bolt", paymentRef: "JUNO-2026-0091",
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const app = store.get(`app/${EV}/${LEAD}.json`);
    expect(app.ticketId).toBe(ticket);
    expect(app.paymentRef).toBe("JUNO-2026-0091");
    expect(app.payment).toBe("awaiting");
    expect(app.status).toBe("pending");
    expect(app.stage).toBeUndefined();
    expect(mailed.received).toBe(1);
    expect(mailed.confirmation).toBe(0);
  });

  it("still covers a joiner — they do not owe the fee", async () => {
    const a = await create();
    const join = await postTeam({
      action: "join", eventId: EV, email: MATE, code: a.body.code,
      name: "Team Mate", phone: "9876543211", college: "RUAS",
    });
    expect(join.status, JSON.stringify(join.body)).toBe(200);
    expect(store.get(`app/${EV}/${MATE}.json`)).toMatchObject({
      status: "pending",
      payment: "not_required",
      fee: COVERED_BY_LEAD,
      teamCode: a.body.code,
    });
    expect(mailed.confirmation).toBe(0);
  });

  it("fills the lead row when a live team comes back without one", async () => {
    const code = "ORPHANCODE1";
    store.set(`team/${EV}/${code}.json`, {
      code, eventId: EV, name: "Orphan", bio: "", createdByEmail: LEAD,
      members: [], createdAt: "2026-10-01T00:00:00.000Z",
    });
    store.set(`member/${EV}/${LEAD}.json`, {
      code, eventId: EV,
      member: { name: "Lead Person", email: LEAD, phone: "9876543210", college: "RUAS", joinedAt: "2026-10-01T00:00:00.000Z" },
    });
    const again = await create(LEAD, "Something Else");
    expect(again.status).toBe(200);
    expect(again.body.restored).toBe(true);
    expect(again.body.code).toBe(code);
    expect(store.get(`app/${EV}/${LEAD}.json`)).toMatchObject({
      status: "pending",
      payment: "awaiting",
      fee: "Rs. 200/-",
      stage: "intent",
      paymentRef: null,
      teamCode: code,
      teamName: "Orphan",
    });
    expect(mailed.received).toBe(0);
    expect(mailed.confirmation).toBe(0);
  });

  it("does not mint a second team or a second fee when they already have both", async () => {
    const a = await create();
    const again = await create(LEAD, "Renamed");
    expect(again.body.restored).toBe(true);
    expect(again.body.code).toBe(a.body.code);
    expect(store.get(`app/${EV}/${LEAD}.json`).teamName).toBe("Bolt");
    const teams = [...store.keys()].filter((k) => k.startsWith(`team/${EV}/`));
    expect(teams).toHaveLength(1);
  });
});

describe("the prompts", () => {
  it("says the shared name creates a separate team for this event", () => {
    const src = readFileSync(fileURLToPath(new URL("../components/registration-dialog.tsx", import.meta.url)), "utf8");
    expect(src).toContain("creates a separate team for");
    expect(src).toContain("with its own code");
    expect(src).not.toContain("Use the same team name here?");
  });

  it("asks the lead on My Tickets to finish registration and pay", () => {
    const src = readFileSync(fileURLToPath(new URL("../app/ticket/page.tsx", import.meta.url)), "utf8");
    expect(src).toContain("Finish registration &amp; pay");
    expect(src).toContain("?finish=reference");
  });
});
