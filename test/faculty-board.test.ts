import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { buildFacultyBoard } from "@/lib/faculty-board";
import { applyAction, canViewFacultyBoard, readAccess, applyAccess, DEFAULT_ACCESS } from "@/lib/access-control";
import { COVERED_BY_LEAD, type Application } from "@/lib/applications";
import type { Team } from "@/lib/teams";

const app = (over: Partial<Application>): Application =>
  ({
    ticketId: "T",
    eventId: "triathlon",
    eventName: "TRIATHLON",
    status: "confirmed",
    payment: "paid",
    fee: "Rs. 200/-",
    name: "Asha",
    email: "asha@x.in",
    phone: "9876543210",
    college: "RUAS",
    teamName: "Byte Me",
    teamCode: "CODE12345678",
    members: null,
    appliedAt: "2026-09-20T10:00:00Z",
    paymentRef: "SECRETREF123",
    ...over,
  }) as Application;

describe("buildFacultyBoard", () => {
  it("groups a team's applications together, lead first", () => {
    const board = buildFacultyBoard([
      app({ name: "Ravi", email: "ravi@x.in", fee: COVERED_BY_LEAD }),
      app({}),
    ]);
    expect(board).toHaveLength(1);
    expect(board[0].confirmed).toBe(true);
    expect(board[0].people.map((p) => p.name)).toEqual(["Asha", "Ravi"]);
    expect(board[0].people[0].isLead).toBe(true);
  });

  it("carries no payment, reference or join-code fields", () => {
    const json = JSON.stringify(buildFacultyBoard([app({})]));
    expect(json).not.toContain("SECRETREF123");
    expect(json).not.toContain("CODE12345678");
    expect(json).not.toContain("paid");
  });

  it("marks a team unconfirmed while nobody on it is confirmed, and says why", () => {
    const board = buildFacultyBoard([
      app({ status: "pending" }),
      app({ status: "pending", stage: "intent", teamCode: null, email: "solo@x.in", name: "Solo" }),
    ]);
    expect(board.every((t) => !t.confirmed)).toBe(true);
    const statuses = board.flatMap((t) => t.people.map((p) => p.status)).sort();
    expect(statuses).toEqual(["awaiting", "incomplete"]);
    expect(board.find((t) => t.solo)?.people[0].name).toBe("Solo");
  });

  it("drops declined and cancelled people", () => {
    expect(buildFacultyBoard([app({ status: "declined" }), app({ status: "cancelled", email: "b@x.in" })])).toEqual([]);
  });

  it("adds a teammate the lead invited who has no application yet", () => {
    const team = { code: "CODE12345678", eventId: "triathlon", name: "Byte Me", members: [] } as unknown as Team;
    const board = buildFacultyBoard([app({})], [team], [
      { code: "CODE12345678", member: { name: "Neha", email: "neha@x.in", phone: "9000000000", college: "RUAS", joinedAt: "", invitedAt: "t" } },
    ]);
    expect(board[0].people.map((p) => [p.name, p.status])).toEqual([
      ["Asha", "confirmed"],
      ["Neha", "invited"],
    ]);
  });
});

describe("faculty access rules", () => {
  it("add and remove faculty through the stored record", () => {
    const added = applyAction(DEFAULT_ACCESS, { type: "add_faculty", email: " Prof@MSRUAS.ac.in " }, "org@x.in");
    if ("error" in added) throw new Error(added.error);
    expect(added.access.faculty.map((g) => g.email)).toEqual(["prof@msruas.ac.in"]);
    expect(canViewFacultyBoard({ kind: "none" }, "prof@msruas.ac.in", added.access)).toBe(true);
    const removed = applyAction(added.access, { type: "remove_faculty", email: "prof@msruas.ac.in" }, "org@x.in");
    if ("error" in removed) throw new Error(removed.error);
    expect(canViewFacultyBoard({ kind: "none" }, "prof@msruas.ac.in", removed.access)).toBe(false);
  });

  it("lets FACULTY_EMAILS and organisers in, nobody else", () => {
    expect(canViewFacultyBoard({ kind: "none" }, "p@x.in", DEFAULT_ACCESS, ["P@x.in"])).toBe(true);
    expect(canViewFacultyBoard({ kind: "organiser" }, "o@x.in", DEFAULT_ACCESS)).toBe(true);
    expect(canViewFacultyBoard({ kind: "coordinator", eventIds: ["x"] }, "c@x.in", DEFAULT_ACCESS)).toBe(false);
    expect(canViewFacultyBoard({ kind: "none" }, null, DEFAULT_ACCESS, [""])).toBe(false);
  });

  it("never turns a faculty grant into a role — no write route can see it", () => {
    const access = readAccess({ faculty: [{ email: "prof@x.in" }] });
    expect(applyAccess({ kind: "none" }, "prof@x.in", access)).toEqual({ kind: "none" });
  });

  it("reads an older record without a faculty list", () => {
    expect(readAccess({ organisers: [] }).faculty).toEqual([]);
  });
});

const faculty = vi.hoisted(() => ({ current: { email: "prof@x.in", allowed: true } as { email: string | null; allowed: boolean } }));
vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveFacultyAccess: async () => faculty.current,
}));
vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) => (prefix === "app/" ? [{ url: "a" }] : []),
  readPrivate: async () => app({}),
}));

describe("GET /api/faculty", () => {
  let route: typeof import("@/app/api/faculty/route");
  beforeAll(async () => {
    route = await import("@/app/api/faculty/route");
  });
  beforeEach(() => {
    faculty.current = { email: "prof@x.in", allowed: true };
  });

  it("401s when signed out and 403s without access", async () => {
    faculty.current = { email: null, allowed: false };
    expect((await route.GET()).status).toBe(401);
    faculty.current = { email: "x@x.in", allowed: false };
    expect((await route.GET()).status).toBe(403);
  });

  it("returns teams for faculty", async () => {
    const body = await (await route.GET()).json();
    expect(body.teams[0].people[0]).toMatchObject({ name: "Asha", college: "RUAS", email: "asha@x.in", phone: "9876543210" });
  });

  it("exposes no write method", () => {
    expect(Object.keys(route).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
  });
});
