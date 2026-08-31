import { describe, it, expect } from "vitest";
import { canViewEvent, type Role } from "@/lib/roles";

/**
 * Coordinators can now admit people, which is a privilege they did not have
 * before. The property that keeps that safe is that scope is re-derived from
 * the session on every scan and never taken from the request body — so these
 * assert the boundary itself rather than the UI in front of it.
 */
describe("who may admit to which event", () => {
  const organiser: Role = { kind: "organiser" };
  const coordinator: Role = { kind: "coordinator", eventIds: ["robo-race", "chaos"] };
  const nobody: Role = { kind: "none" };

  it("an organiser may admit to any event", () => {
    expect(canViewEvent(organiser, "robo-race")).toBe(true);
    expect(canViewEvent(organiser, "hacktivate")).toBe(true);
  });

  it("a coordinator may admit to their own events", () => {
    expect(canViewEvent(coordinator, "robo-race")).toBe(true);
    expect(canViewEvent(coordinator, "chaos")).toBe(true);
  });

  it("a coordinator may NOT admit to an event they don't run", () => {
    expect(canViewEvent(coordinator, "hacktivate")).toBe(false);
    expect(canViewEvent(coordinator, "zero-hour")).toBe(false);
  });

  it("someone with no role may admit to nothing", () => {
    expect(canViewEvent(nobody, "robo-race")).toBe(false);
  });

  it("is not fooled by a near-miss event id", () => {
    // Guards against a prefix or substring check creeping in later.
    expect(canViewEvent(coordinator, "robo-race-2")).toBe(false);
    expect(canViewEvent(coordinator, "robo")).toBe(false);
    expect(canViewEvent(coordinator, "chao")).toBe(false);
  });
});
