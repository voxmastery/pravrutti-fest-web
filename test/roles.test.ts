import { describe, it, expect, afterEach } from "vitest";
import { events } from "@/lib/pravrutti-data";
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

  it("does not grant roppashreeganesh@gmail.com every event", () => {
    const granted = events
      .filter((e) =>
        (e.dashboardEmails ?? []).some(
          (a) => a.trim().toLowerCase() === "roppashreeganesh@gmail.com"
        )
      )
      .map((e) => e.name);
    expect(granted).toEqual([]);
  });
});

describe("roleForEmail", () => {
  const originalOrganisers = process.env.ORGANISER_EMAILS;

  afterEach(() => {
    process.env.ORGANISER_EMAILS = originalOrganisers;
  });

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

  it("promotes a dashboardEmails address to organiser when it is also in ORGANISER_EMAILS", () => {
    process.env.ORGANISER_EMAILS = "voxmastery@gmail.com";
    expect(roleForEmail("voxmastery@gmail.com")).toEqual({ kind: "organiser" });
  });

  it("falls through to coordinator when ORGANISER_EMAILS is empty and the address is only in dashboardEmails", () => {
    process.env.ORGANISER_EMAILS = "";
    expect(roleForEmail("voxmastery@gmail.com")).toEqual({
      kind: "coordinator",
      eventIds: ["chaos", "hacktivate"],
    });
  });

  it("gives a per-event coordinator only the events they are listed on", () => {
    expect(roleForEmail("arbharaath@gmail.com")).toEqual({
      kind: "coordinator",
      eventIds: ["robo-race", "kurukshetra-the-robo-war"],
    });
  });

  it("does not treat roppashreeganesh@gmail.com as a coordinator until an event is assigned", () => {
    process.env.ORGANISER_EMAILS = "voxmastery@gmail.com";
    expect(roleForEmail("roppashreeganesh@gmail.com")).toEqual({ kind: "none" });
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
