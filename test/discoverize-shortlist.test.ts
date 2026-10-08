import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The coordinators' shortlist, kept in code (lib/discoverize-shortlist).
   It must open the ₹200 pay step for exactly the teams it names — their
   payer owes, their teammates are shortlisted and owe nothing — and leave
   every other Discoverize team, and every other event, exactly as stored. */

const store = new Map<string, any>();
const mailed: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let sl: typeof import("@/lib/discoverize-shortlist");
let verifyPayment: typeof import("@/lib/payment-review").verifyPayment;
let discoverizeState: typeof import("@/lib/discoverize").discoverizeState;
let maySubmitAbstract: typeof import("@/lib/discoverize").maySubmitAbstract;
let putShortlistFlag: typeof import("@/lib/discoverize-shortlist-flags").putShortlistFlag;
let shortlistFlagPath: typeof import("@/lib/discoverize-shortlist-flags").shortlistFlagPath;
let TABLE_SQL: string;
beforeAll(async () => {
  sl = await import("@/lib/discoverize-shortlist");
  ({ verifyPayment } = await import("@/lib/payment-review"));
  ({ discoverizeState, maySubmitAbstract } = await import("@/lib/discoverize"));
  ({ putShortlistFlag, shortlistFlagPath, DISCOVERIZE_SHORTLIST_TABLE_SQL: TABLE_SQL } =
    await import("@/lib/discoverize-shortlist-flags"));
});

const EV = "discoverize-research-paper-presentation";
const LISTED_LEAD = "kssambavi06@gmail.com"; // Recharge, a team
const LISTED_SOLO = "nayanasree1906@gmail.com"; // a solo entry
const MATE = "agna.nelson682@gmail.com";
const STRANGER = "not.shortlisted@example.com";
const CODE = "RECHARGE0001";

const row = (email: string, over: Record<string, unknown> = {}) => ({
  ticketId: "PRV-1", eventId: EV, eventName: "Discoverize (Research Paper Presentation)",
  status: "pending", payment: "not_required", fee: "Free",
  name: email.split("@")[0], email, phone: "9876543210", college: "RUAS",
  teamName: "Recharge", teamCode: CODE, members: null, appliedAt: "2026-10-01T09:00:00.000Z", ...over,
}) as any;

beforeEach(() => {
  store.clear(); mailed.length = 0;
  store.set(`team/${EV}/${CODE}.json`, { code: CODE, eventId: EV, name: "Recharge", createdByEmail: LISTED_LEAD, members: [] });
});

describe("the list itself", () => {
  it("is lowercase, trimmed and has no duplicates", () => {
    for (const e of sl.DISCOVERIZE_SHORTLIST) expect(e).toBe(e.trim().toLowerCase());
    expect(new Set(sl.DISCOVERIZE_SHORTLIST).size).toBe(sl.DISCOVERIZE_SHORTLIST.length);
    /* First 14 on 6 Oct, second 7 on 8 Oct. */
    expect(sl.DISCOVERIZE_SHORTLIST).toHaveLength(21);
  });

  it("keeps the shortlist table additive", () => {
    expect(TABLE_SQL).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(TABLE_SQL).not.toMatch(/\b(DROP|ALTER)\b/i);
  });

  it("matches regardless of case and spaces", () => {
    expect(sl.onDiscoverizeShortlist("  KSSambavi06@Gmail.com ")).toBe(true);
    expect(sl.onDiscoverizeShortlist(STRANGER)).toBe(false);
    expect(sl.onDiscoverizeShortlist(null)).toBe(false);
  });
});

describe("withDiscoverizeShortlist", () => {
  it("makes a listed lead shortlisted and owing the team's Rs. 200/-", async () => {
    const a = await sl.withDiscoverizeShortlist(row(LISTED_LEAD));
    expect(a.round?.shortlistedAt).toBeTruthy();
    expect(a.payment).toBe("awaiting");
    expect(a.fee).toBe("Rs. 200/-");
    expect(discoverizeState(a)).toBe("payment_pending");
  });

  it("does the same for a listed solo entrant", async () => {
    const a = await sl.withDiscoverizeShortlist(row(LISTED_SOLO, { teamCode: null, teamName: null }));
    expect(discoverizeState(a)).toBe("payment_pending");
  });

  it("shortlists a listed team's teammate without charging them", async () => {
    const a = await sl.withDiscoverizeShortlist(row(MATE));
    expect(a.round?.shortlistedAt).toBeTruthy();
    expect(a.payment).toBe("not_required");
    expect(discoverizeState(a)).toBe("shortlisted");
  });

  it("leaves a Discoverize team that is not on the list exactly as stored", async () => {
    const r = row(STRANGER, { teamCode: null });
    expect(await sl.withDiscoverizeShortlist(r)).toEqual(r);
  });

  it("leaves every other event alone, even for a listed address", async () => {
    const r = row(LISTED_LEAD, { eventId: "chaos", payment: "awaiting", fee: "Rs. 200/-" });
    expect(await sl.withDiscoverizeShortlist(r)).toEqual(r);
  });

  it("leaves a withdrawn or declined registration alone", async () => {
    for (const status of ["cancelled", "declined"]) {
      const r = row(LISTED_LEAD, { status });
      expect(await sl.withDiscoverizeShortlist(r)).toEqual(r);
    }
  });

  it("never rewrites money that is already settled or submitted", async () => {
    const paid = await sl.withDiscoverizeShortlist(row(LISTED_LEAD, { payment: "paid", fee: "Rs. 200/-" }));
    expect(paid.payment).toBe("paid");
    const sent = await sl.withDiscoverizeShortlist(
      row(LISTED_LEAD, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "JIDCWIOOPNU1QEV", round: { paymentSubmittedAt: "z" } }),
    );
    expect(discoverizeState(sent)).toBe("payment_submitted");
  });

  it("reads nothing into the store — it is a view, not a write", async () => {
    store.set(`app/${EV}/${LISTED_LEAD}.json`, row(LISTED_LEAD));
    await sl.withDiscoverizeShortlist(store.get(`app/${EV}/${LISTED_LEAD}.json`));
    expect(store.get(`app/${EV}/${LISTED_LEAD}.json`).payment).toBe("not_required");
  });

  it("shortlists a lead named only by a stored flag, and takes the abstract away", async () => {
    await putShortlistFlag(STRANGER, true, "aaliyahaijaz2006@gmail.com", "2026-10-07T12:00:00.000Z");
    const a = await sl.withDiscoverizeShortlist(row(STRANGER, { teamCode: null, teamName: null }));
    expect(a.round?.shortlistedBy).toBe("aaliyahaijaz2006@gmail.com");
    expect(a.payment).toBe("awaiting");
    expect(a.fee).toBe("Rs. 200/-");
    expect(discoverizeState(a)).toBe("payment_pending");
    expect(maySubmitAbstract(a)).toBe(false);
  });

  it("shortlists that lead's teammate without charging them", async () => {
    store.set(`team/${EV}/${CODE}.json`, { code: CODE, eventId: EV, name: "Recharge", createdByEmail: STRANGER, members: [] });
    await putShortlistFlag(STRANGER, true, "aaliyahaijaz2006@gmail.com", "2026-10-07T12:00:00.000Z");
    const a = await sl.withDiscoverizeShortlist(row(MATE));
    expect(a.payment).toBe("not_required");
    expect(discoverizeState(a)).toBe("shortlisted");
    expect(maySubmitAbstract(a)).toBe(false);
  });

  it("an explicit removal beats the hardcoded list", async () => {
    await putShortlistFlag(LISTED_LEAD, false, "coord@example.com", "2026-10-07T12:00:00.000Z");
    const r = row(LISTED_LEAD);
    expect(await sl.withDiscoverizeShortlist(r)).toEqual(r);
    expect(maySubmitAbstract(r)).toBe(true);
  });

  it("an explicit removal takes the pay step back off a row that was already marked", async () => {
    await putShortlistFlag(LISTED_LEAD, false, "coord@example.com", "2026-10-07T12:00:00.000Z");
    const a = await sl.withDiscoverizeShortlist(row(LISTED_LEAD, {
      payment: "awaiting", fee: "Rs. 200/-",
      round: { shortlistedAt: "y", shortlistedBy: "list", abstractSubmittedAt: "abs" },
    }));
    expect(a.round?.shortlistedAt).toBeUndefined();
    expect(a.round?.abstractSubmittedAt).toBe("abs");
    expect(a.payment).toBe("not_required");
    expect(a.fee).toBe("Free");
    expect(discoverizeState(a)).toBe("abstract_submitted");
    expect(maySubmitAbstract(a)).toBe(false);
  });
});

describe("seeding the first set", () => {
  it("inserts the hardcoded leads and does not put a removal back", async () => {
    await putShortlistFlag(LISTED_LEAD, false, "coord@example.com", "2026-10-07T12:00:00.000Z");
    await sl.ensureDiscoverizeShortlistSeed();
    expect(store.get(shortlistFlagPath(LISTED_LEAD)).shortlisted).toBe(false);
    expect(store.get(shortlistFlagPath(LISTED_SOLO)).shortlisted).toBe(true);
    expect(sl.DISCOVERIZE_SHORTLIST.every((e) => store.has(shortlistFlagPath(e)))).toBe(true);
  });
});

describe("verifying a listed team's payment", () => {
  it("records the ₹200 as paid and confirms the team's payer", async () => {
    store.set(`app/${EV}/${LISTED_LEAD}.json`, row(LISTED_LEAD, { payment: "awaiting", fee: "Rs. 200/-", paymentRef: "JIDCWIOOPNU1QEV" }));
    const out = await verifyPayment({ eventId: EV, email: LISTED_LEAD, by: "org@example.com" });
    expect(out?.application.status).toBe("confirmed");
    expect(out?.application.payment).toBe("paid");
    expect(mailed).toEqual([LISTED_LEAD]);
  });

  it("still refuses a Discoverize team nobody shortlisted", async () => {
    store.set(`app/${EV}/${STRANGER}.json`, row(STRANGER, { teamCode: null }));
    const out = await verifyPayment({ eventId: EV, email: STRANGER, by: "org@example.com" });
    expect(out?.application.status).toBe("pending");
    expect(mailed).toEqual([]);
  });
});
