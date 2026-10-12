import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { ticketPayload } from "@/lib/ticket-qr";

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  gatePath: (email: string) => `gate/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ url: pathname, pathname })),
  readPrivate: async (url: string) => store.get(url) ?? null,
  listTeamMembers: async () => [],
  casUpdate: async (path: string, decide: (current: unknown) => Promise<{ write: boolean; next: unknown }> | { write: boolean; next: unknown }) => {
    const current = store.get(path) ?? null;
    const decision = await decide(current);
    if (decision.write && decision.next != null) store.set(path, decision.next);
    return { current, written: !!(decision.write && decision.next != null), next: decision.write ? decision.next : current };
  },
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
// canViewEvent stays real on purpose: it is the scope check the route leans
// on, so mocking it would hollow out what these tests prove.
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "boss@pravrutti.test", authRequired: () => false }));

// Imported in beforeAll (not a top-level await) so the mocks above are
// registered first while still keeping this file's target/module settings
// compatible with `tsc --noEmit` under the project's tsconfig.
let POST: typeof import("@/app/api/checkin/route").POST;
let GATE: typeof import("@/app/api/checkin/gate/route").POST;
let UNDO: typeof import("@/app/api/checkin/undo/route").POST;
let SEARCH: typeof import("@/app/api/checkin/search/route").GET;
let COUNTS: typeof import("@/app/api/checkin/counts/route").GET;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/checkin/route"));
  ({ POST: GATE } = await import("@/app/api/checkin/gate/route"));
  ({ POST: UNDO } = await import("@/app/api/checkin/undo/route"));
  ({ GET: SEARCH } = await import("@/app/api/checkin/search/route"));
  ({ GET: COUNTS } = await import("@/app/api/checkin/counts/route"));
});

const post = (payload: string) =>
  POST(new Request("http://t/api/checkin", {
    method: "POST",
    body: JSON.stringify({ payload }),
  }));

beforeEach(() => {
  store.clear();
  role.current = { kind: "organiser" };
  store.set("app/robo-climb/asha@example.com.json", {
    ticketId: "PRV-AAAA1111",
    eventId: "robo-climb",
    eventName: "Robo Climb",
    status: "confirmed",
    name: "Asha",
    email: "asha@example.com",
  });
});

describe("POST /api/checkin", () => {
  it("admits a confirmed ticket", async () => {
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyCheckedIn).toBe(false);
    expect(body.name).toBe("Asha");
  });

  it("is idempotent and keeps the original timestamp", async () => {
    const first = await (await post("PRV-AAAA1111|robo-climb|asha@example.com")).json();
    const second = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    const body = await second.json();
    expect(body.alreadyCheckedIn).toBe(true);
    expect(body.at).toBe(first.at);
    expect(body.by).toBe("boss@pravrutti.test");
  });

  /* Coordinators may now admit people to their OWN events — a deliberate
     reversal of the original "observe only" non-goal. What still has to hold
     is that the scope comes from the session, not the request. */
  it("lets a coordinator admit to their own event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Asha");
  });

  it("rejects a coordinator admitting to an event they don't run", async () => {
    role.current = { kind: "coordinator", eventIds: ["chaos"] };
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(403);
  });

  it("rejects someone with no role", async () => {
    role.current = { kind: "none" };
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(403);
  });

  it("ignores a client-supplied eventId outside the caller's scope", async () => {
    // The desk names the event, but naming one you don't run must not work.
    role.current = { kind: "coordinator", eventIds: ["chaos"] };
    const res = await POST(
      new Request("http://t/api/checkin", {
        method: "POST",
        body: JSON.stringify({
          payload: "PRV-AAAA1111|robo-climb|asha@example.com",
          eventId: "robo-climb",
        }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("refuses a ticket for another event and names where they are registered", async () => {
    role.current = { kind: "coordinator", eventIds: ["chaos"] };
    const res = await POST(
      new Request("http://t/api/checkin", {
        method: "POST",
        body: JSON.stringify({
          payload: "PRV-AAAA1111|robo-climb|asha@example.com",
          eventId: "chaos",
        }),
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("wrong_event");
    expect(body.events.map((e: { eventName: string }) => e.eventName)).toContain("Robo Climb");
    expect(store.get("app/robo-climb/asha@example.com.json").checkedInAt).toBeUndefined();
  });

  it("rejects a pending application and names the status", async () => {
    store.get("app/robo-climb/asha@example.com.json").status = "pending";
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/pending/i);
  });

  it("rejects a ticketId that does not match the stored record", async () => {
    const res = await post("PRV-WRONG999|robo-climb|asha@example.com");
    expect(res.status).toBe(404);
  });

  it("rejects a malformed QR", async () => {
    const res = await post("https://example.com");
    expect(res.status).toBe(400);
  });

  it("rejects an unreasonably long payload before parsing it", async () => {
    // A real payload (ticketId|eventId|email) is well under 200 chars.
    // A body this long is not a scan, so it must be rejected without
    // ever reaching parseTicketPayload or a storage lookup.
    const res = await post("A".repeat(10_000));
    expect(res.status).toBe(400);
  });

  it("admits a payload built by ticketPayload at the named desk", async () => {
    const payload = ticketPayload({
      ticketId: "PRV-AAAA1111",
      eventId: "robo-climb",
      email: "asha@example.com",
    });
    const res = await POST(
      new Request("http://t/api/checkin", {
        method: "POST",
        body: JSON.stringify({ payload, eventId: "robo-climb" }),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Asha");
  });

  it("admits a 16-hex ticket id, the format newTicketId now issues", async () => {
    store.set("app/robo-climb/bina@example.com.json", {
      ticketId: "PRV-DEADBEEFCAFEBABE",
      eventId: "robo-climb",
      eventName: "Robo Climb",
      status: "confirmed",
      name: "Bina",
      email: "bina@example.com",
    });
    const payload = ticketPayload({
      ticketId: "PRV-DEADBEEFCAFEBABE",
      eventId: "robo-climb",
      email: "bina@example.com",
    });
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await POST(
      new Request("http://t/api/checkin", {
        method: "POST",
        body: JSON.stringify({ payload, eventId: "robo-climb" }),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Bina");
  });

  it("admits an old QR after the email on the registration was corrected", async () => {
    store.delete("app/robo-climb/asha@example.com.json");
    store.set("app/robo-climb/asha.rao@example.com.json", {
      ticketId: "PRV-AAAA1111",
      eventId: "robo-climb",
      eventName: "Robo Climb",
      status: "confirmed",
      name: "Asha Rao",
      email: "asha.rao@example.com",
    });
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Asha Rao");
    expect(body.email).toBe("asha.rao@example.com");
    expect(store.get("app/robo-climb/asha.rao@example.com.json").checkedInAt).toBeTruthy();
  });

  it("checks in from a name lookup without a QR", async () => {
    const res = await POST(new Request("http://t/api/checkin", {
      method: "POST",
      body: JSON.stringify({ eventId: "robo-climb", email: "asha@example.com" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyCheckedIn).toBe(false);
  });

  it("undoes a check-in inside 30 seconds and records an audit row", async () => {
    await post("PRV-AAAA1111|robo-climb|asha@example.com");
    const res = await UNDO(new Request("http://t/api/checkin/undo", {
      method: "POST",
      body: JSON.stringify({ eventId: "robo-climb", email: "asha@example.com" }),
    }));
    expect(res.status).toBe(200);
    expect(store.get("app/robo-climb/asha@example.com.json").checkedInAt).toBeUndefined();
    const audit = [...store.keys()].some((k) => k.startsWith("checkin-audit/") && store.get(k).action === "undo-desk");
    expect(audit).toBe(true);
  });

  it("refuses an undo after 30 seconds", async () => {
    store.get("app/robo-climb/asha@example.com.json").checkedInAt = "2020-01-01T00:00:00.000Z";
    store.get("app/robo-climb/asha@example.com.json").checkedInBy = "boss@pravrutti.test";
    const res = await UNDO(new Request("http://t/api/checkin/undo", {
      method: "POST",
      body: JSON.stringify({ eventId: "robo-climb", email: "asha@example.com" }),
    }));
    expect(res.status).toBe(409);
    expect(store.get("app/robo-climb/asha@example.com.json").checkedInAt).toBe("2020-01-01T00:00:00.000Z");
  });
});

describe("gate and lookup", () => {
  it("does not write a gate entry for a cancelled ticket", async () => {
    store.get("app/robo-climb/asha@example.com.json").status = "cancelled";
    const res = await GATE(new Request("http://t/api/checkin/gate", {
      method: "POST",
      body: JSON.stringify({ payload: "PRV-AAAA1111|robo-climb|asha@example.com" }),
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("cancelled");
    expect([...store.keys()].some((k) => k.startsWith("gate/"))).toBe(false);
  });

  it("records gate entry once for a confirmed ticket and lists their events", async () => {
    const res = await GATE(new Request("http://t/api/checkin/gate", {
      method: "POST",
      body: JSON.stringify({ payload: "PRV-AAAA1111|robo-climb|asha@example.com" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyEntered).toBe(false);
    expect(body.events.map((e: { eventName: string }) => e.eventName)).toContain("Robo Climb");
    const again = await GATE(new Request("http://t/api/checkin/gate", {
      method: "POST",
      body: JSON.stringify({ payload: "PRV-AAAA1111|robo-climb|asha@example.com" }),
    }));
    const second = await again.json();
    expect(second.alreadyEntered).toBe(true);
    expect(second.enteredAt).toBe(body.enteredAt);
  });

  it("refuses a coordinator at the gate", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await GATE(new Request("http://t/api/checkin/gate", {
      method: "POST",
      body: JSON.stringify({ payload: "PRV-AAAA1111|robo-climb|asha@example.com" }),
    }));
    expect(res.status).toBe(403);
  });

  it("searches by phone and hides other events from a coordinator", async () => {
    store.get("app/robo-climb/asha@example.com.json").phone = "9876543210";
    store.set("app/chaos/asha@example.com.json", {
      ticketId: "PRV-CHAOS1",
      eventId: "chaos",
      eventName: "Chaos",
      status: "confirmed",
      name: "Asha",
      email: "asha@example.com",
      phone: "9876543210",
    });
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await SEARCH(new Request("http://t/api/checkin/search?q=9876543210"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { eventId: string }) => r.eventId)).toEqual(["robo-climb"]);
  });

  it("counts confirmed check-ins for the caller's events", async () => {
    store.get("app/robo-climb/asha@example.com.json").checkedInAt = "2026-10-14T04:00:00.000Z";
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await COUNTS();
    const body = await res.json();
    expect(body.gate).toBeNull();
    expect(body.events.find((e: { eventId: string }) => e.eventId === "robo-climb")).toMatchObject({
      checkedIn: 1,
      confirmed: 1,
    });
  });
});
