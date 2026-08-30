import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";
import { roleForEmail, canViewEvent } from "@/lib/roles";

describe("Event.dashboardEmails", () => {
  it("is optional and absent until the spreadsheet lands", () => {
    const e = events.find((x) => eventId(x.name) === "electroxcape")!;
    expect(e).toBeDefined();
    expect(e.dashboardEmails ?? []).toEqual([]);
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
