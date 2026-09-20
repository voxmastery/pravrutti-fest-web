import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Turning a team away is one decision too. Declining the lead alone refunds
   the only fee and leaves the teammates pending on a place nobody is paying
   for — they wait, and nobody is coming. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async () => ({ sent: true }),
}));

let declineTeam: typeof import("@/lib/payment-review").declineTeam;
beforeAll(async () => { ({ declineTeam } = await import("@/lib/payment-review")); });

const EV = "chaos", CODE = "6R99V74RK69C", LEAD = "lead@example.com";
const MATES = ["a@example.com", "b@example.com"];

const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: `PRV-${email[0].toUpperCase()}`, eventId: EV, eventName: "CHAOS", email,
    name: email.split("@")[0], status: "pending",
    payment: email === LEAD ? "awaiting" : "not_required",
    fee: "Rs. 200/-", teamName: "ERROR404", teamCode: CODE,
    appliedAt: "2026-09-18T09:00:00.000Z", ...over,
  });
};
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

beforeEach(() => {
  store.clear();
  for (const e of [LEAD, ...MATES]) row(e);
});

describe("declineTeam", () => {
  it("declines every member in one call", async () => {
    const out = await declineTeam({ eventId: EV, code: CODE });
    expect(out!.applications).toHaveLength(3);
    expect([LEAD, ...MATES].every((e) => read(e).status === "declined")).toBe(true);
    expect([LEAD, ...MATES].every((e) => !!read(e).decidedAt)).toBe(true);
  });

  /* One payment came in, so one refund goes out. Teammates were never
     charged — stamping them "refunded" would invent three refunds. */
  it("refunds the lead's fee and nobody else's", async () => {
    await declineTeam({ eventId: EV, code: CODE });
    expect(read(LEAD).payment).toBe("refunded");
    expect(read(LEAD).refundedAt).toBeTruthy();
    expect(MATES.every((e) => read(e).payment === "not_required")).toBe(true);
    expect(MATES.every((e) => read(e).refundedAt === undefined)).toBe(true);
  });

  it("refunds a fee that was already verified as paid", async () => {
    row(LEAD, { payment: "paid", status: "confirmed" });
    await declineTeam({ eventId: EV, code: CODE });
    expect(read(LEAD).payment).toBe("refunded");
    expect(read(LEAD).status).toBe("declined");
  });

  it("leaves withdrawn members alone", async () => {
    row("a@example.com", { status: "cancelled" });
    const out = await declineTeam({ eventId: EV, code: CODE });
    expect(out!.applications.map((a) => a.email).sort()).toEqual([LEAD, "b@example.com"].sort());
    expect(read("a@example.com").status).toBe("cancelled");
  });

  it("touches only the event it was asked about", async () => {
    store.set(`app/hacktivate/${LEAD}.json`, {
      eventId: "hacktivate", email: LEAD, name: "lead", status: "pending",
      payment: "awaiting", teamCode: CODE, appliedAt: "x",
    });
    await declineTeam({ eventId: EV, code: CODE });
    expect(store.get(`app/hacktivate/${LEAD}.json`).status).toBe("pending");
  });

  it("ignores other teams on the same event", async () => {
    store.set(`app/${EV}/other@example.com.json`, {
      eventId: EV, email: "other@example.com", name: "other", status: "pending",
      payment: "awaiting", teamCode: "ZZZZZZZZZZZZ", appliedAt: "x",
    });
    await declineTeam({ eventId: EV, code: CODE });
    expect(store.get(`app/${EV}/other@example.com.json`).status).toBe("pending");
  });

  it("answers null when there is no live team behind that code", async () => {
    expect(await declineTeam({ eventId: EV, code: "ZZZZZZZZZZZZ" })).toBeNull();
  });

  /* Declining twice must not stamp a second refund date over the first. */
  it("does not re-decline a team that is already declined", async () => {
    await declineTeam({ eventId: EV, code: CODE });
    const first = read(LEAD).refundedAt;
    expect(await declineTeam({ eventId: EV, code: CODE })).toBeNull();
    expect(read(LEAD).refundedAt).toBe(first);
  });
});
