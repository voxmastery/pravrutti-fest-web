import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Confirming a Discoverize team means something different from everywhere
 * else, and that is how two teams ended up in the wrong place.
 *
 * Every other event: confirmed = your payment cleared, you are in. For
 * Discoverize nothing is paid, and `discoverizeState` reads a confirmed row
 * as "Final round confirmed" — the last rung of a ladder whose earlier rungs
 * are submitting an abstract and being shortlisted by the judges. So one
 * click on the desk promoted two teams straight past the screening, and
 * their tickets told them they were through to the presentation round.
 *
 * The desk cannot be expected to remember that one event of twenty-five
 * inverts the meaning of its own button, so the rule lives here: a
 * Discoverize row the judges have not shortlisted cannot be confirmed.
 */

const store = new Map<string, any>();
const mailed: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let verifyPayment: typeof import("@/lib/payment-review").verifyPayment;
let DISC: string;
beforeAll(async () => {
  ({ verifyPayment } = await import("@/lib/payment-review"));
  ({ DISCOVERIZE_EVENT_ID: DISC } = await import("@/lib/discoverize"));
});

const ME = "team@example.com";
const row = (eventId: string, over: Record<string, unknown> = {}) =>
  store.set(`app/${eventId}/${ME}.json`, {
    ticketId: "PRV-1", eventId, eventName: "X", status: "pending", payment: "not_required",
    fee: "Free", name: "A Team", email: ME, phone: "9876543210", college: "RUAS",
    teamName: "Loopers", teamCode: "TEAM1", appliedAt: "2026-09-20T09:00:00.000Z", ...over,
  });
const read = (eventId: string) => store.get(`app/${eventId}/${ME}.json`);

beforeEach(() => { store.clear(); mailed.length = 0; });

describe("confirming a Discoverize registration", () => {
  it("refuses a team the judges have not shortlisted", async () => {
    row(DISC);
    const out = await verifyPayment({ eventId: DISC, email: ME, by: "org@example.com" });
    expect(out?.application.status).toBe("pending");
    expect(mailed).toEqual([]);
  });

  it("refuses one that has only submitted its abstract", async () => {
    row(DISC, { round: { abstractSubmittedAt: "2026-09-21T10:00:00.000Z", abstractSource: "form" } });
    const out = await verifyPayment({ eventId: DISC, email: ME, by: "org@example.com" });
    expect(out?.application.status).toBe("pending");
    expect(mailed).toEqual([]);
  });

  it("allows one the judges did shortlist — that is the real final round", async () => {
    row(DISC, {
      round: {
        abstractSubmittedAt: "2026-09-21T10:00:00.000Z",
        shortlistedAt: "2026-09-23T10:00:00.000Z",
        shortlistedBy: "judge@example.com",
      },
    });
    const out = await verifyPayment({ eventId: DISC, email: ME, by: "org@example.com" });
    expect(out?.application.status).toBe("confirmed");
    expect(mailed).toEqual([ME]);
  });

  /* The guard must not reach past its one event. */
  it("leaves every other event exactly as it was", async () => {
    row("chaos", { payment: "awaiting", fee: "Rs. 200/-" });
    const out = await verifyPayment({ eventId: "chaos", email: ME, by: "org@example.com" });
    expect(out?.application.status).toBe("confirmed");
    expect(read("chaos").payment).toBe("paid");
    expect(mailed).toEqual([ME]);
  });

  /* Already through: re-running must not throw or undo anything. */
  it("leaves an already-confirmed Discoverize row alone", async () => {
    row(DISC, { status: "confirmed", round: { shortlistedAt: "2026-09-23T10:00:00.000Z" } });
    const out = await verifyPayment({ eventId: DISC, email: ME, by: "org@example.com" });
    expect(out?.application.status).toBe("confirmed");
  });
});
