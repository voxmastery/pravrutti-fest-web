import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";
import { roleForEmail, canViewEvent } from "@/lib/roles";

describe("Event.dashboardEmails", () => {
  /* This used to assert the field was absent "until the spreadsheet lands".
     It has landed, so the invariant inverts: an event with no dashboard
     emails is an event whose coordinators cannot see their own roster. */
  it("is populated for every event", () => {
    const missing = events
      .filter((e) => (e.dashboardEmails ?? []).length === 0)
      .map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it("stores addresses lowercased, so role lookup matches", () => {
    const notLower = events
      .flatMap((e) => e.dashboardEmails ?? [])
      .filter((a) => a !== a.toLowerCase());
    expect(notLower).toEqual([]);
  });

  it("gives each event at least one reachable address", () => {
    const bad = events
      .flatMap((e) => (e.dashboardEmails ?? []).map((a) => [e.name, a] as const))
      .filter(([, a]) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    expect(bad).toEqual([]);
  });
});

describe("roleForEmail", () => {
  it("returns organiser for an ORGANISER_EMAILS entry", () => {
    expect(roleForEmail("boss@pravrutti.test")).toEqual({ kind: "organiser" });
  });

  it("is case-insensitive", () => {
    expect(roleForEmail("BOSS@Pravrutti.TEST")).toEqual({ kind: "organiser" });
  });

  it("returns none for an unknown email", () => {
    expect(roleForEmail("stranger@example.com")).toEqual({ kind: "none" });
  });

  it("returns none for null", () => {
    expect(roleForEmail(null)).toEqual({ kind: "none" });
  });
});

describe("canViewEvent", () => {
  it("lets an organiser view any event", () => {
    expect(canViewEvent({ kind: "organiser" }, "robo-climb")).toBe(true);
  });

  it("lets a coordinator view only their own events", () => {
    const role = { kind: "coordinator" as const, eventIds: ["robo-climb"] };
    expect(canViewEvent(role, "robo-climb")).toBe(true);
    expect(canViewEvent(role, "skycraft")).toBe(false);
  });

  it("denies a roleless account", () => {
    expect(canViewEvent({ kind: "none" }, "robo-climb")).toBe(false);
  });
});
