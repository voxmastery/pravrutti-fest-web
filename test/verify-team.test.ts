import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The fee is ₹200 for the team, paid by the lead, so approving is a decision
   about the team — not about four people who happen to share a code. One
   click confirms all of them, and nobody is charged twice for it. */

const store = new Map<string, any>();
const sent: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (r: any) => { sent.push(r.email); return { sent: true }; },
}));

let verifyTeam: typeof import("@/lib/payment-review").verifyTeam;
beforeAll(async () => { ({ verifyTeam } = await import("@/lib/payment-review")); });

const EV = "chaos", CODE = "6R99V74RK69C";
const LEAD = "lead@example.com";

const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: `PRV-${email[0].toUpperCase()}`, eventId: EV, eventName: "CHAOS", email,
    name: email.split("@")[0], status: "pending",
    payment: email === LEAD ? "awaiting" : "not_required",
    fee: "Rs. 200/-", teamName: "ERROR404", teamCode: CODE,
    paymentRef: email === LEAD ? "626165961670" : null,
    appliedAt: "2026-09-18T09:29:52.799Z", ...over,
  });
};

const team = () => [LEAD, "a@example.com", "b@example.com", "c@example.com"].map((e) => store.get(`app/${EV}/${e}.json`));

beforeEach(() => {
  store.clear(); sent.length = 0;
  for (const e of [LEAD, "a@example.com", "b@example.com", "c@example.com"]) row(e);
});

describe("verifyTeam", () => {
  it("confirms every member in one call", async () => {
    const out = await verifyTeam({ eventId: EV, code: CODE, by: "organiser@example.com" });
    expect(out).not.toBeNull();
    expect(out!.applications).toHaveLength(4);
    expect(team().every((a) => a.status === "confirmed")).toBe(true);
  });

  /* Only the lead paid. Stamping the others as "paid" would put four ₹200
     payments in the books where one was taken. */
  it("records the money against the lead alone", async () => {
    await verifyTeam({ eventId: EV, code: CODE, by: "organiser@example.com" });
    const [lead, ...mates] = team();
    expect(lead.payment).toBe("paid");
    expect(lead.paymentVerifiedBy).toBe("organiser@example.com");
    expect(mates.every((m) => m.payment === "not_required")).toBe(true);
    expect(mates.every((m) => m.paymentVerifiedAt === undefined)).toBe(true);
  });

  it("emails every member their ticket, once", async () => {
    await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    expect(sent.sort()).toEqual([LEAD, "a@example.com", "b@example.com", "c@example.com"].sort());
  });

  /* Pressing it again must not put a second ticket in four inboxes. */
  it("does not re-email a team that is already confirmed", async () => {
    await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    sent.length = 0;
    const out = await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    expect(sent).toEqual([]);
    expect(out!.applications).toHaveLength(4);
    expect(team().every((a) => a.status === "confirmed")).toBe(true);
  });

  it("leaves withdrawn and declined members out of it", async () => {
    row("a@example.com", { status: "cancelled" });
    row("b@example.com", { status: "declined" });
    const out = await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    expect(out!.applications.map((a) => a.email).sort()).toEqual([LEAD, "c@example.com"].sort());
    expect(store.get(`app/${EV}/a@example.com.json`).status).toBe("cancelled");
    expect(store.get(`app/${EV}/b@example.com.json`).status).toBe("declined");
    expect(sent.sort()).toEqual([LEAD, "c@example.com"].sort());
  });

  /* A team that moved events keeps its code. Confirming it on one event must
     not reach into the other. */
  it("touches only the event it was asked about", async () => {
    store.set(`app/hacktivate/${LEAD}.json`, {
      ticketId: "PRV-OLD", eventId: "hacktivate", email: LEAD, name: "lead",
      status: "pending", payment: "awaiting", teamCode: CODE, appliedAt: "x",
    });
    await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    expect(store.get(`app/hacktivate/${LEAD}.json`).status).toBe("pending");
  });

  it("ignores other teams on the same event", async () => {
    store.set(`app/${EV}/other@example.com.json`, {
      ticketId: "PRV-X", eventId: EV, email: "other@example.com", name: "other",
      status: "pending", payment: "awaiting", teamCode: "ZZZZZZZZZZZZ", appliedAt: "x",
    });
    await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com" });
    expect(store.get(`app/${EV}/other@example.com.json`).status).toBe("pending");
  });

  it("answers null when there is no live team behind that code", async () => {
    expect(await verifyTeam({ eventId: EV, code: "ZZZZZZZZZZZZ", by: "o@example.com" })).toBeNull();
  });

  /* The desk sometimes reads the reference off the statement rather than the
     registration. It belongs on the payer's row, not on all four. */
  it("puts an organiser-supplied reference on the payer only", async () => {
    await verifyTeam({ eventId: EV, code: CODE, by: "o@example.com", paymentRef: "JIDCWIOOPNU1QEV" });
    const [lead, ...mates] = team();
    expect(lead.paymentRef).toBe("JIDCWIOOPNU1QEV");
    expect(mates.every((m) => m.paymentRef === null)).toBe(true);
  });
});
