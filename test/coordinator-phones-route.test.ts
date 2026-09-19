import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Coordinator mobiles are public on the event page so a visitor can call
   before registering. The hall, Contact, and More stay behind access. These
   tests are the split: contacts for any valid slug, venue only when entitled. */

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
let coordinatorPhones: typeof import("@/lib/coordinator-phones").coordinatorPhones;
beforeAll(async () => {
  ({ GET } = await import("@/app/api/events/coordinators/route"));
  ({ events, eventId } = await import("@/lib/pravrutti-data"));
  ({ coordinatorPhones } = await import("@/lib/coordinator-phones"));
});

const get = (slug: string) =>
  GET(new Request(`http://t/api/events/coordinators?event=${encodeURIComponent(slug)}`));

const EVENT = "robo-race";
const KEY = `app/${EVENT}/asha@example.com.json`;

const applied = (status: string) => ({
  ticketId: "PRV-1", eventId: EVENT, eventName: "Robo Race",
  status, payment: status === "confirmed" ? "paid" : "awaiting",
  name: "Asha", email: "asha@example.com", appliedAt: "2026-09-01T00:00:00.000Z",
});

const expectContacts = (body: { contacts?: { name: string; phone: string }[] }) => {
  expect(body.contacts?.length).toBeGreaterThan(0);
  for (const c of body.contacts ?? []) {
    expect(c.name).toBeTruthy();
    expect(c.phone).toMatch(/\d/);
  }
};

beforeEach(() => {
  store.clear();
  who.email = null;
  who.role = { kind: "none" };
});

describe("coordinator numbers stay off the public events array", () => {
  it("does not put coordinator mobiles in pravrutti-data", () => {
    const publicData = JSON.stringify(events);
    for (const e of events) {
      for (const c of coordinatorPhones(eventId(e.name))) {
        const digits = c.phone.replace(/\D/g, "");
        if (digits.length >= 10) expect(publicData).not.toContain(digits);
      }
    }
  });
});

describe("GET /api/events/coordinators", () => {
  it("gives contacts to a signed-out visitor, but not the hall", async () => {
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.registered).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
  });

  it("gives contacts to a signed-in person who never registered", async () => {
    who.email = "stranger@example.com";
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.registered).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
  });

  it("gives contacts while an application is still pending approval", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("pending"));
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
    /* Phones are public, but the event page still needs to know this
       viewer applied — otherwise Request to Join never goes away. */
    expect(body.registered).toBe(true);
    expect(body.status).toBe("pending");
  });

  it("never lets caches keep a viewer's access from before they applied", async () => {
    who.email = "asha@example.com";
    const before = await get(EVENT);
    expect(before.headers.get("cache-control")).toMatch(/no-store/i);

    store.set(KEY, applied("pending"));
    const after = await get(EVENT);
    expect(after.headers.get("cache-control")).toMatch(/no-store/i);
    expect((await after.json()).status).toBe("pending");
  });

  it("gives contacts to a declined application without unlocking the hall", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("declined"));
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
  });

  it("gives the numbers and the hall to an approved participant", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("confirmed"));
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(true);
    expect(body.registered).toBe(true);
    expectContacts(body);
  });

  it("gives the numbers to an organiser", async () => {
    who.email = "boss@pravrutti.test";
    who.role = { kind: "organiser" };
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(true);
    expect(body.registered).toBe(true);
    expectContacts(body);
  });

  it("gives a coordinator their own event", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: [EVENT] };
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(true);
    expect(body.registered).toBe(true);
    expectContacts(body);
  });

  it("gives public contacts to a coordinator of a different event, not the hall", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: ["line-follower"] };
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.registered).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
  });

  it("does not unlock one event with an approval for a different one", async () => {
    who.email = "asha@example.com";
    store.set(`app/line-follower/asha@example.com.json`, {
      ...applied("confirmed"), eventId: "line-follower",
    });
    const body = await (await get(EVENT)).json();
    expect(body.unlocked).toBe(false);
    expect(body.venue).toBeUndefined();
    expectContacts(body);
  });

  it("404s an event that doesn't exist instead of guessing", async () => {
    who.email = "boss@pravrutti.test";
    who.role = { kind: "organiser" };
    expect((await get("no-such-event")).status).toBe(404);
  });
});

/* Contact + More are for people already in this event. That bar is lower than
   the hall gate: pending counts, declined does not. Call buttons are public
   and do not wait on `registered` or `unlocked`. */
describe("GET /api/events/coordinators — registered (host actions)", () => {
  it("does not count a signed-out visitor as registered", async () => {
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(false);
    expect(body.unlocked).toBe(false);
    expectContacts(body);
  });

  it("does not count a signed-in person who never applied", async () => {
    who.email = "stranger@example.com";
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(false);
    expect(body.unlocked).toBe(false);
    expectContacts(body);
  });

  it("counts a pending application as registered without handing over the hall", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("pending"));
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(true);
    expect(body.unlocked).toBe(false);
    expect(body.status).toBe("pending");
    expectContacts(body);
    expect(body.venue).toBeUndefined();
  });

  it("does not count a declined application as registered", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("declined"));
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(false);
    expect(body.unlocked).toBe(false);
    expectContacts(body);
  });

  it("counts a confirmed participant as registered", async () => {
    who.email = "asha@example.com";
    store.set(KEY, applied("confirmed"));
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(true);
    expect(body.unlocked).toBe(true);
  });

  it("counts organisers as registered for every event", async () => {
    who.email = "boss@pravrutti.test";
    who.role = { kind: "organiser" };
    expect((await (await get(EVENT)).json()).registered).toBe(true);
  });

  it("counts a coordinator as registered only for their own event", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: [EVENT] };
    expect((await (await get(EVENT)).json()).registered).toBe(true);
  });

  it("does not count a coordinator of a different event as registered here", async () => {
    who.email = "coord@pravrutti.test";
    who.role = { kind: "coordinator", eventIds: ["line-follower"] };
    expect((await (await get(EVENT)).json()).registered).toBe(false);
  });

  it("does not count an approval for a different event as registered here", async () => {
    who.email = "asha@example.com";
    store.set(`app/line-follower/asha@example.com.json`, {
      ...applied("confirmed"), eventId: "line-follower",
    });
    const body = await (await get(EVENT)).json();
    expect(body.registered).toBe(false);
    expect(body.unlocked).toBe(false);
    expectContacts(body);
  });
});
