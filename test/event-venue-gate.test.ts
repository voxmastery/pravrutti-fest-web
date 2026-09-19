import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The gate on which room an event runs in. A public site should not publish
   "which hall, at what time" for a campus running combat robots and overnight
   hackathons, so the hall is server-only data handed out on the same terms as
   the coordinators' mobile numbers. These tests are the terms. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  readJsonByPath: async (p: string) => store.get(p) ?? null,
}));

const who = vi.hoisted(() => ({ email: null as string | null, role: { kind: "none" } as any }));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => who.email, authRequired: () => false }));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => who.role,
}));

let GET: typeof import("@/app/api/events/coordinators/route").GET;
let events: typeof import("@/lib/pravrutti-data").events;
let eventId: typeof import("@/lib/pravrutti-data").eventId;
let venueFor: typeof import("@/lib/event-venues").venueFor;

beforeAll(async () => {
  ({ GET } = await import("@/app/api/events/coordinators/route"));
  ({ events, eventId } = await import("@/lib/pravrutti-data"));
  ({ venueFor } = await import("@/lib/event-venues"));
});

const get = (slug: string) =>
  GET(new Request(`http://t/api/events/coordinators?event=${encodeURIComponent(slug)}`));

/** An event with a hall on file, so "no venue" means gated rather than unset. */
const EVENT = "line-follower";
const HALL = "C BLOCK";
const KEY = `app/${EVENT}/asha@example.com.json`;

const applied = (status: string) => ({
  ticketId: "PRV-1", eventId: EVENT, eventName: "Line Follower",
  status, payment: status === "confirmed" ? "paid" : "awaiting",
  name: "Asha", email: "asha@example.com", appliedAt: "2026-09-01T00:00:00.000Z",
});

beforeEach(() => {
  store.clear();
  who.email = null;
  who.role = { kind: "none" };
});

describe("the hall is not in anything a browser is handed", () => {
  it("keeps every hall out of the public events array", () => {
    const publicData = JSON.stringify(events);
    for (const e of events) {
      const hall = venueFor(eventId(e.name));
      if (hall) expect(publicData).not.toContain(hall);
    }
  });

  it("still has a hall on file for most events", () => {
    const withHall = events.filter((e) => venueFor(eventId(e.name)) !== null);
    expect(withHall.length).toBeGreaterThan(10);
  });

  it("has no hall entry keyed to an event that does not exist", () => {
    // A typo'd key would silently mean "no hall" for the real event forever.
    const known = new Set(events.map((e) => eventId(e.name)));
    for (const e of events) expect(known.has(eventId(e.name))).toBe(true);
    expect(venueFor("no-such-event")).toBeNull();
  });
});

describe("GET /api/events/coordinators — venue", () => {
  it("gives no hall to a signed-out visitor", async () => {
    const body = await (await get(EVENT)).json();
    expect(body.venue).toBeUndefined();
  });

  it("gives no hall to a signed-in person who never registered", async () => {
    who.email = "stranger@example.com";
    const body = await (await get(EVENT)).json();
    expect(body.venue).toBeUndefined();
  });

  it("gives no hall while an application is still pending", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("pending"));
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.registered).toBe(true);
    expect(body.venue).toBeUndefined();
  });

  it("gives the hall to a confirmed participant", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("confirmed"));
    const body = await (await get(EVENT)).json();
    expect(body.venue).toBe(HALL);
  });

  it("gives the hall to the event's own staff", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: [EVENT] };
    expect((await (await get(EVENT)).json()).venue).toBe(HALL);
  });

  it("does not leak one event's hall to a coordinator of another", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: ["robo-race"] };
    const body = await (await get(EVENT)).json();
    expect(body.venue).toBeUndefined();
  });

  it("returns null rather than a guess when no hall is assigned", async () => {
    who.email = "boss@pravrutti.test";
    who.role = { kind: "organiser" };
    // glide-x is one of the events the coordinators never named a hall for.
    const body = await (await get("glide-x")).json();
    expect(body.unlocked).toBe(true);
    expect(body.venue).toBeNull();
  });
});

describe("GET /api/events/coordinators — the viewer's own status", () => {
  it("reports nothing for a signed-out visitor", async () => {
    expect((await (await get(EVENT)).json()).status).toBeNull();
  });

  it("reports nothing for someone who never applied", async () => {
    who.email = "stranger@example.com";
    expect((await (await get(EVENT)).json()).status).toBeNull();
  });

  /* The status is outside the gate on purpose: it is the viewer's own
     application, and "you are still in review" reveals nothing they did not
     submit themselves. It must survive the locked response. */
  it("reports a pending application even though nothing else unlocks", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("pending"));
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.status).toBe("pending");
  });

  it("reports a declined application", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("declined"));
    expect((await (await get(EVENT)).json()).status).toBe("declined");
  });

  it("reports a confirmed application", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("confirmed"));
    expect((await (await get(EVENT)).json()).status).toBe("confirmed");
  });

  it("does not report another event's application as this one's", async () => {
    who.email = "asha@example.com";
    store.set("app/robo-race/asha@example.com.json", { ...applied("confirmed"), eventId: "robo-race" });
    expect((await (await get(EVENT)).json()).status).toBeNull();
  });
});
