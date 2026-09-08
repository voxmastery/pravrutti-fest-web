import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { events } from "@/lib/pravrutti-data";

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [],
  readPrivate: async () => null,
}));

let meGET: typeof import("@/app/api/dashboard/me/route").GET;
let overviewGET: typeof import("@/app/api/dashboard/overview/route").GET;
beforeAll(async () => {
  ({ GET: meGET } = await import("@/app/api/dashboard/me/route"));
  ({ GET: overviewGET } = await import("@/app/api/dashboard/overview/route"));
});

beforeEach(() => {
  role.current = { kind: "organiser" };
});

describe("GET /api/dashboard/me", () => {
  it("returns only assigned events for a coordinator", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race"] };
    const body = await (await meGET()).json();
    expect(body.role).toBe("coordinator");
    expect(body.events).toEqual([{ eventId: "robo-race", name: "ROBO RACE" }]);
  });

  it("cannot expand a coordinator's list past role.eventIds", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race", "line-follower"] };
    const body = await (await meGET()).json();
    expect(body.events.map((e: { eventId: string }) => e.eventId).sort()).toEqual(
      ["line-follower", "robo-race"]
    );
    expect(body.events.length).toBeLessThan(events.length);
  });

  it("returns every event for an organiser", async () => {
    const body = await (await meGET()).json();
    expect(body.role).toBe("organiser");
    expect(body.events.length).toBe(events.length);
  });

  it("returns no events for a roleless account", async () => {
    role.current = { kind: "none" };
    const body = await (await meGET()).json();
    expect(body).toEqual({ role: "none", events: [] });
  });
});

describe("GET /api/dashboard/overview", () => {
  it("403s a coordinator who asks for the fest overview", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race"] };
    expect((await overviewGET()).status).toBe(403);
  });

  it("lets an organiser read the fest overview", async () => {
    expect((await overviewGET()).status).toBe(200);
  });
});
