import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Discoverize's two organiser-side moves: recording that an abstract arrived,
   and putting a team through to the presentation round. Both act on the whole
   team, because the entry is a team's and so is the ₹200. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));

let lib: typeof import("@/lib/discoverize-review");
beforeAll(async () => { lib = await import("@/lib/discoverize-review"); });

const EV = "discoverize-research-paper-presentation";
const LEAD = "lead@example.com", MATE = "mate@example.com", SOLO = "solo@example.com";
const CODE = "DISCTEAM0001";

const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: `PRV-${email[0].toUpperCase()}`, eventId: EV, eventName: "Discoverize (Research Paper Presentation)",
    status: "pending", payment: "not_required", fee: "Free",
    name: email.split("@")[0], email, phone: "9876543210", college: "RUAS",
    teamName: "Team One", teamCode: CODE, appliedAt: "2026-09-19T09:00:00.000Z", ...over,
  });
};
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

beforeEach(() => {
  store.clear();
  store.set(`team/${EV}/${CODE}.json`, { code: CODE, eventId: EV, name: "Team One", createdByEmail: LEAD, members: [], createdAt: "x" });
  row(LEAD); row(MATE);
  row(SOLO, { teamCode: null, teamName: null });
});

describe("markAbstractSubmitted", () => {
  it("marks the whole team from any one member's email", async () => {
    const out = await lib.markAbstractSubmitted({ email: MATE, source: "form" });
    expect(out!.applications).toHaveLength(2);
    expect(read(LEAD).round.abstractSubmittedAt).toBeTruthy();
    expect(read(MATE).round.abstractSubmittedAt).toBeTruthy();
    expect(read(LEAD).round.abstractSource).toBe("form");
  });

  it("marks a solo entry on its own", async () => {
    await lib.markAbstractSubmitted({ email: SOLO, source: "form" });
    expect(read(SOLO).round.abstractSubmittedAt).toBeTruthy();
    expect(read(LEAD).round).toBeUndefined();
  });

  it("keeps the first submission time when the form fires twice", async () => {
    await lib.markAbstractSubmitted({ email: LEAD, source: "form" });
    const first = read(LEAD).round.abstractSubmittedAt;
    await lib.markAbstractSubmitted({ email: LEAD, source: "form" });
    expect(read(LEAD).round.abstractSubmittedAt).toBe(first);
  });

  it("answers null for an address with no Discoverize registration", async () => {
    expect(await lib.markAbstractSubmitted({ email: "stranger@example.com", source: "form" })).toBeNull();
  });

  /* A withdrawn team is not waiting on an abstract. */
  it("ignores a cancelled registration", async () => {
    row(SOLO, { teamCode: null, status: "cancelled" });
    expect(await lib.markAbstractSubmitted({ email: SOLO, source: "form" })).toBeNull();
  });
});

describe("setShortlisted", () => {
  it("puts the whole team through and puts the ₹200 on the lead alone", async () => {
    const out = await lib.setShortlisted({ code: CODE, by: "coordinator@example.com", shortlisted: true });
    expect(out && "applications" in out && out.applications).toHaveLength(2);
    expect(read(LEAD).round.shortlistedAt).toBeTruthy();
    expect(read(LEAD).round.shortlistedBy).toBe("coordinator@example.com");
    expect(read(MATE).round.shortlistedAt).toBeTruthy();
    expect(read(LEAD).payment).toBe("awaiting");
    expect(read(LEAD).fee).toBe("Rs. 200/-");
    /* The teammate is covered by the lead. */
    expect(read(MATE).payment).toBe("not_required");
  });

  it("shortlists a solo entry against its own row, which then owes the fee", async () => {
    await lib.setShortlisted({ email: SOLO, by: "c@example.com", shortlisted: true });
    expect(read(SOLO).round.shortlistedAt).toBeTruthy();
    expect(read(SOLO).payment).toBe("awaiting");
  });

  it("clears the mark and the fee when a team is un-shortlisted", async () => {
    await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: true });
    await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: false });
    expect(read(LEAD).round?.shortlistedAt).toBeUndefined();
    expect(read(MATE).round?.shortlistedAt).toBeUndefined();
    expect(read(LEAD).payment).toBe("not_required");
    expect(read(LEAD).fee).toBe("Free");
  });

  /* Money that did arrive is never rewritten either way. */
  it("leaves a paid row's money alone", async () => {
    store.set(`app/${EV}/${LEAD}.json`, { ...read(LEAD), payment: "paid", fee: "Rs. 200/-" });
    await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: true });
    expect(read(LEAD).payment).toBe("paid");
    expect(read(LEAD).fee).toBe("Rs. 200/-");
    expect(read(LEAD).round.shortlistedAt).toBeTruthy();
  });

  it("refuses to un-shortlist a team that has already paid", async () => {
    store.set(`app/${EV}/${LEAD}.json`, { ...read(LEAD), payment: "paid", fee: "Rs. 200/-", round: { shortlistedAt: "y" } });
    const out = await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: false });
    expect(out && "error" in out).toBe(true);
    expect(read(LEAD).round.shortlistedAt).toBe("y");
  });

  it("leaves other teams and other events alone", async () => {
    store.set(`app/${EV}/other@example.com.json`, { eventId: EV, email: "other@example.com", status: "pending", payment: "not_required", teamCode: "OTHERTEAM001" });
    store.set(`app/chaos/${LEAD}.json`, { eventId: "chaos", email: LEAD, status: "pending", payment: "awaiting", teamCode: CODE });
    await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: true });
    expect(store.get(`app/${EV}/other@example.com.json`).round).toBeUndefined();
    expect(store.get(`app/${EV}/other@example.com.json`).payment).toBe("not_required");
    expect(store.get(`app/chaos/${LEAD}.json`).round).toBeUndefined();
  });

  /* The judges decide how many go through — the code must not. */
  it("has no cap on how many teams can be shortlisted", async () => {
    for (let i = 0; i < 40; i++) {
      const code = `BULKTEAM${String(i).padStart(4, "0")}`;
      const email = `bulk${i}@example.com`;
      store.set(`team/${EV}/${code}.json`, { code, eventId: EV, createdByEmail: email, name: `T${i}` });
      row(email, { teamCode: code });
      const out = await lib.setShortlisted({ code, by: "c@example.com", shortlisted: true });
      expect(out, `team ${i}`).not.toBeNull();
    }
    const shortlisted = [...store.values()].filter((v) => v?.round?.shortlistedAt).length;
    expect(shortlisted).toBe(40);
  });

  it("answers null for a team nobody registered", async () => {
    expect(await lib.setShortlisted({ code: "NOSUCHTEAM01", by: "c@example.com", shortlisted: true })).toBeNull();
  });
});

describe("migrateToFreeEntry", () => {
  it("leaves a shortlisted team's round fee alone", async () => {
    await lib.setShortlisted({ code: CODE, by: "c@example.com", shortlisted: true });
    await lib.migrateToFreeEntry();
    expect(read(LEAD).payment).toBe("awaiting");
    expect(read(LEAD).fee).toBe("Rs. 200/-");
  });
});
