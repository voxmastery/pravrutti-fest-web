import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * What a late joiner walks into.
 *
 * Accepting an invite mints the member their own application, and it was
 * always minted "pending" — which is right while the team is still in review
 * and wrong the moment the team has been confirmed. A lead who adds somebody
 * to an approved team would otherwise hand them a ticket that says "In review"
 * and never moves, because the organiser already took that decision.
 *
 * The fee is ₹200 for the team and the lead paid it, so a later member costs
 * nothing and settles nothing — they inherit the decision, exactly as the
 * team desk's own "approve the whole team" does.
 */

const store = new Map<string, any>();
const mailed: string[] = [];
const mail = vi.hoisted(() => ({ throws: false, result: { sent: true } as { sent: boolean; error?: string } }));

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  /* The invite route checks whether the event is full, which lists the
     event's registrations. */
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/mailer", () => ({ siteOrigin: () => "https://pravrutti.tech" }));
vi.mock("@/lib/pravrutti-data", async (o) => {
  const actual = await o<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    /* BRIDGE IT is closed on the live list. This file is about the invite. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "bridge-it" ? { ...e, full: false } : e,
    ),
  };
});
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => {
    if (mail.throws) throw new Error("smtp down");
    mailed.push(a.email);
    return mail.result;
  },
}));

let GET: typeof import("@/app/invite/[token]/route").GET;
beforeAll(async () => { ({ GET } = await import("@/app/invite/[token]/route")); });

const TOKEN = "b".repeat(64);
const EV = "bridge-it", CODE = "TEAMBBBB2222";
const LEAD = "lead@example.com", MATE = "mate@example.com";
const AT = "2026-09-20T06:00:00.000Z";

const accept = () =>
  GET(new Request(`https://pravrutti.tech/invite/${TOKEN}`), { params: Promise.resolve({ token: TOKEN }) });

const app = () => store.get(`app/${EV}/${MATE}.json`);

/** An invited member of a team whose lead sits at `leadStatus`. */
function seed(leadStatus: "pending" | "confirmed") {
  store.set(`invite/${TOKEN}.json`, { token: TOKEN, eventId: EV, code: CODE, email: MATE, createdAt: AT });
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  store.set(`member/${EV}/${MATE}.json`, {
    code: CODE, eventId: EV,
    member: { name: "Ravi Kumar", email: MATE, phone: "9876543211", college: "RUAS",
              joinedAt: AT, invitedAt: AT, inviteToken: TOKEN },
  });
  store.set(`app/${EV}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EV, eventName: "BRIDGE IT",
    status: leadStatus, payment: leadStatus === "confirmed" ? "paid" : "awaiting",
    fee: "Rs. 200/-", name: "Asha Rao", email: LEAD, phone: "9876543210", college: "RUAS",
    teamName: "Bolt", teamCode: CODE, appliedAt: AT,
  });
}

beforeEach(() => {
  store.clear(); mailed.length = 0; mail.throws = false; mail.result = { sent: true };
});

describe("accepting an invite into a team that is already confirmed", () => {
  it("confirms the new member instead of parking them in review", async () => {
    seed("confirmed");
    await accept();
    expect(app().status).toBe("confirmed");
    expect(app().decidedAt).toBeTruthy();
  });

  /* The team's ₹200 is the lead's and stays the lead's — four "paid" stamps
     would put ₹800 in the books where ₹200 was taken. */
  it("records nothing as collected from them", async () => {
    seed("confirmed");
    await accept();
    expect(app().payment).toBe("not_required");
    expect(app().fee).toMatch(/lead/i);
    expect(app().paymentVerifiedAt).toBeUndefined();
  });

  it("sends them the ticket, because a confirmed place has one", async () => {
    seed("confirmed");
    await accept();
    expect(mailed).toEqual([MATE]);
  });

  it("stamps the send on their row, like every other confirmation", async () => {
    seed("confirmed");
    await accept();
    expect(app().confirmationEmailAt).toBeTruthy();
    expect(app().confirmationEmailError).toBeNull();
  });

  /* The place is kept either way — but a refusal that goes unrecorded is a
     student nobody knows to chase. Hostinger throttles this mailbox, and
     nine teammates sat confirmed-and-silent for days because the outcome of
     this one send was thrown away. Recorded, they show on the desk as owed a
     ticket and the resend queue picks them up. */
  it("records a refusal instead of dropping it", async () => {
    seed("confirmed");
    mail.result = { sent: false, error: '451 4.7.1 Ratelimit "hostinger_out_ratelimit" exceeded' };
    await accept();
    expect(app().status).toBe("confirmed");
    expect(app().confirmationEmailAt ?? null).toBeNull();
    expect(app().confirmationEmailError).toMatch(/Ratelimit/);
  });

  it("records a send that threw, and still keeps the place", async () => {
    seed("confirmed");
    mail.throws = true;
    await accept();
    expect(app().status).toBe("confirmed");
    expect(app().confirmationEmailAt ?? null).toBeNull();
    expect(app().confirmationEmailError).toBeTruthy();
  });
});

describe("accepting an invite into a team still in review", () => {
  it("leaves them in review alongside their lead", async () => {
    seed("pending");
    await accept();
    expect(app().status).toBe("pending");
    expect(app().payment).toBe("not_required");
    expect(mailed).toEqual([]);
  });

  /* No registration to inherit from — the lead invited before submitting. */
  it("stays pending when the lead has not registered yet", async () => {
    seed("pending");
    store.delete(`app/${EV}/${LEAD}.json`);
    await accept();
    expect(app().status).toBe("pending");
    expect(mailed).toEqual([]);
  });

  it("never revives a team whose lead withdrew", async () => {
    seed("pending");
    store.set(`app/${EV}/${LEAD}.json`, { ...store.get(`app/${EV}/${LEAD}.json`), status: "cancelled" });
    await accept();
    expect(app().status).toBe("pending");
  });
});

describe("what accepting never does", () => {
  it("leaves an application they already have exactly as it is", async () => {
    seed("confirmed");
    store.set(`app/${EV}/${MATE}.json`, {
      ticketId: "PRV-MINE", eventId: EV, eventName: "BRIDGE IT", status: "pending", payment: "awaiting",
      fee: "Rs. 200/-", name: "Ravi Kumar", email: MATE, phone: "9876543211", college: "RUAS",
      teamName: "Bolt", teamCode: CODE, appliedAt: AT,
    });
    await accept();
    expect(app().ticketId).toBe("PRV-MINE");
    expect(app().status).toBe("pending");
    expect(mailed).toEqual([]);
  });

  /* Cancelled is not a live place — they withdrew from an earlier team and
     are joining this one. Leaving the cancelled row in place is how Astrea's
     Tathagata Roy (Logic Circuit) sat on the roster with no QR. */
  it("replaces a cancelled registration so they get a ticket on the new team", async () => {
    seed("confirmed");
    store.set(`app/${EV}/${MATE}.json`, {
      ticketId: "PRV-OLD", eventId: EV, eventName: "BRIDGE IT", status: "cancelled",
      payment: "not_required", fee: "Covered by team lead", name: "Ravi Kumar", email: MATE,
      phone: "9876543211", college: "RUAS", teamName: "Old Team", teamCode: "OLDTEAM000001",
      appliedAt: "2026-09-01T00:00:00.000Z", cancelledAt: "2026-09-02T00:00:00.000Z",
    });
    await accept();
    expect(app().status).toBe("confirmed");
    expect(app().teamCode).toBe(CODE);
    expect(app().teamName).toBe("Bolt");
    expect(app().ticketId).toBe("PRV-OLD");
    expect(mailed).toEqual([MATE]);
  });

  /* A bounced ticket email must not undo an acceptance the lead can already
     see on the roster. */
  it("keeps the confirmation even when the email fails", async () => {
    seed("confirmed");
    mail.throws = true;
    const res = await accept();
    expect(app().status).toBe("confirmed");
    expect(new URL(res.headers.get("location")!).pathname).toBe(`/teams/${EV}/${CODE}`);
  });
});
