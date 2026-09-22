import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The two ways a Discoverize row changes from outside the student's own
   screen: the Google Form telling us an abstract landed, and a coordinator
   putting a team through. Both are gates, so both are tested as gates. */

const store = new Map<string, any>();
const role = vi.hoisted(() => ({ value: { kind: "none" } as any, email: null as string | null }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => role.value,
  canViewEvent: (r: any, ev: string) => r.kind === "organiser" || (r.kind === "coordinator" && r.eventIds.includes(ev)),
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => role.email }));

let ABSTRACT: typeof import("@/app/api/discoverize/abstract/route");
let DESK: typeof import("@/app/api/dashboard/discoverize/route");
let token: string;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  const { abstractWebhookToken } = await import("@/lib/abstract-webhook");
  token = abstractWebhookToken()!;
  ABSTRACT = await import("@/app/api/discoverize/abstract/route");
  DESK = await import("@/app/api/dashboard/discoverize/route");
});

const EV = "discoverize-research-paper-presentation";
const LEAD = "lead@example.com", MATE = "mate@example.com";
const CODE = "DISCTEAM0001";

const row = (email: string, over: Record<string, unknown> = {}) => {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-1", eventId: EV, eventName: "Discoverize (Research Paper Presentation)",
    status: "pending", payment: "not_required", fee: "Free · Rs. 200/- only if shortlisted",
    name: email.split("@")[0], email, phone: "9876543210", college: "RUAS",
    teamName: "Team One", teamCode: CODE, appliedAt: "2026-09-19T09:00:00.000Z", ...over,
  });
};
const read = (email: string) => store.get(`app/${EV}/${email}.json`);

const hook = async (body: unknown, tok = token) => {
  const res = await ABSTRACT.POST(new Request("http://t/api/discoverize/abstract", {
    method: "POST", headers: { "content-type": "application/json", "x-abstract-token": String(tok) },
    body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const desk = async (body: unknown) => {
  const res = await DESK.POST(new Request("http://t/api/dashboard/discoverize", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  store.clear();
  store.set(`team/${EV}/${CODE}.json`, { code: CODE, eventId: EV, name: "Team One", createdByEmail: LEAD, members: [], createdAt: "x" });
  row(LEAD); row(MATE);
  role.value = { kind: "none" }; role.email = null;
});

describe("POST /api/discoverize/abstract (the Google Form's webhook)", () => {
  it("refuses a wrong or missing token", async () => {
    expect((await hook({ email: LEAD }, "nope")).status).toBe(401);
    expect((await hook({ email: LEAD }, "")).status).toBe(401);
    expect(read(LEAD).round).toBeUndefined();
  });

  it("records the abstract against the whole team", async () => {
    const res = await hook({ email: MATE, title: "A paper" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: true, marked: 2 });
    expect(read(LEAD).round.abstractSubmittedAt).toBeTruthy();
    expect(read(LEAD).round.abstractSource).toBe("form");
  });

  it("is case and space insensitive about the address people type", async () => {
    expect((await hook({ email: "  LEAD@Example.com " })).body).toMatchObject({ matched: true });
  });

  /* Somebody filled the form with an address they did not register with.
     Answer 200 so Apps Script does not retry forever, but keep the row so a
     coordinator can chase it. */
  it("accepts an unknown address without marking anything, and keeps it for the desk", async () => {
    const res = await hook({ email: "stranger@example.com", title: "Orphan" });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
    const unmatched = [...store.keys()].filter((k) => k.startsWith("abstract-unmatched/"));
    expect(unmatched).toHaveLength(1);
    expect(store.get(unmatched[0])).toMatchObject({ email: "stranger@example.com" });
  });

  it("rejects a body with no address at all", async () => {
    expect((await hook({ title: "no email" })).status).toBe(400);
  });
});

describe("POST /api/dashboard/discoverize (shortlisting)", () => {
  it("refuses a visitor and a coordinator of a different event", async () => {
    expect((await desk({ action: "shortlist", code: CODE })).status).toBe(403);
    role.value = { kind: "coordinator", eventIds: ["chaos"] };
    expect((await desk({ action: "shortlist", code: CODE })).status).toBe(403);
    expect(read(LEAD).round).toBeUndefined();
  });

  it("lets this event's coordinator shortlist, and records who did it", async () => {
    role.value = { kind: "coordinator", eventIds: [EV] }; role.email = "coord@example.com";
    const res = await desk({ action: "shortlist", code: CODE });
    expect(res.status).toBe(200);
    expect(read(LEAD).round.shortlistedBy).toBe("coord@example.com");
    /* Free event: going through asks nobody for money. */
    expect(read(LEAD).payment).toBe("not_required");
    expect(read(MATE).payment).toBe("not_required");
  });

  it("lets an organiser un-shortlist, which clears the mark", async () => {
    role.value = { kind: "organiser" }; role.email = "org@example.com";
    await desk({ action: "shortlist", code: CODE });
    const res = await desk({ action: "unshortlist", code: CODE });
    expect(res.status).toBe(200);
    expect(read(LEAD).round?.shortlistedAt).toBeUndefined();
  });

  it("marks an abstract by hand when the form route has not been wired", async () => {
    role.value = { kind: "organiser" }; role.email = "org@example.com";
    const res = await desk({ action: "mark_abstract", email: LEAD });
    expect(res.status).toBe(200);
    expect(read(LEAD).round.abstractSource).toBe("organiser");
  });

  it("answers 404 for a team that does not exist", async () => {
    role.value = { kind: "organiser" };
    expect((await desk({ action: "shortlist", code: "NOSUCHTEAM01" })).status).toBe(404);
  });

  it("serves the roster to the desk, grouped by team", async () => {
    role.value = { kind: "coordinator", eventIds: [EV] };
    const res = await DESK.GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.teams).toHaveLength(1);
    expect(body.teams[0].members).toHaveLength(2);
    expect(body.teams[0].state).toBe("registered");
  });
});
