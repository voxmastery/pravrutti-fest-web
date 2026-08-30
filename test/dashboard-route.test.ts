import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const apps: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => apps.map((_, i) => ({ pathname: `p${i}`, url: `u${i}` })),
  readPrivate: async (url: string) => apps[Number(url.slice(1))],
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", async () => {
  const actual = await vi.importActual<any>("@/lib/roles");
  return { ...actual, resolveRole: async () => role.current };
});

// Imported in beforeAll (not a top-level await) so the mocks above are
// registered first while still keeping this file's target/module settings
// compatible with `tsc --noEmit` under the project's tsconfig.
let GET: typeof import("@/app/api/dashboard/event/[eventId]/route").GET;
beforeAll(async () => {
  ({ GET } = await import("@/app/api/dashboard/event/[eventId]/route"));
});

const get = (eventId: string) =>
  GET(new Request("http://t"), { params: Promise.resolve({ eventId }) });

beforeEach(() => {
  role.current = { kind: "organiser" };
  apps.length = 0;
  apps.push(
    { eventId: "robo-climb", name: "Asha", college: "RUAS", email: "a@x.com",
      phone: "9000000001", status: "confirmed", checkedInAt: "2026-10-15T04:42:00.000Z" },
    { eventId: "robo-climb", name: "Bala", college: "RUAS", email: "b@x.com",
      phone: "9000000002", status: "confirmed" },
    { eventId: "robo-climb", name: "Chetan", college: "BMS", email: "c@x.com",
      phone: "9000000003", status: "pending" },
    { eventId: "skycraft", name: "Deepa", college: "RUAS", email: "d@x.com",
      phone: "9000000004", status: "confirmed" },
  );
});

describe("GET /api/dashboard/event/[eventId]", () => {
  it("NEVER returns contact details", async () => {
    const body = await (await get("robo-climb")).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("@x.com");
    expect(serialised).not.toContain("9000000001");
    for (const p of body.roster) {
      expect(p).not.toHaveProperty("email");
      expect(p).not.toHaveProperty("phone");
    }
  });

  it("counts registered, confirmed, checked in and not arrived", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.counts).toEqual({
      registered: 3, confirmed: 2, checkedIn: 1, notArrived: 1,
    });
  });

  it("returns only this event's applicants", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.roster.map((r: any) => r.name).sort()).toEqual(["Asha", "Bala", "Chetan"]);
  });

  it("lets a coordinator read their own event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("robo-climb")).status).toBe(200);
  });

  it("denies a coordinator another event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("skycraft")).status).toBe(403);
  });

  it("denies a roleless account", async () => {
    role.current = { kind: "none" };
    expect((await get("robo-climb")).status).toBe(403);
  });
});
