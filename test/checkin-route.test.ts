import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
// canViewEvent stays real on purpose: it is the scope check the route leans
// on, so mocking it would hollow out what these tests prove.
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "boss@pravrutti.test" }));

// Imported in beforeAll (not a top-level await) so the mocks above are
// registered first while still keeping this file's target/module settings
// compatible with `tsc --noEmit` under the project's tsconfig.
let POST: typeof import("@/app/api/checkin/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/checkin/route"));
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

  it("says 'not registered' when scanned at a desk they didn't sign up for", async () => {
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
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not registered/i);
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
});
