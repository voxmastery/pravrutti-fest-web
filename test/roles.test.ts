import { describe, it, expect, afterEach } from "vitest";
import { events } from "@/lib/pravrutti-data";
import { roleForEmail, canViewEvent } from "@/lib/roles";

describe("Event.dashboardEmails", () => {
  /* This used to assert the field was absent "until the spreadsheet lands".
     It has landed, so the invariant inverts: an event with no dashboard
     emails is an event whose coordinators cannot see their own roster. */
  /* Events whose coordinators changed and whose replacements have not yet
     given their Google addresses. Access was revoked rather than left with
     people who no longer run the event, so these have NO coordinator login
     until the new addresses arrive — an organiser has to cover the desk.
     Empty this list as the addresses come in; it is not a place to park an
     event indefinitely. */
  const AWAITING_ADDRESSES: string[] = [];

  it("is populated for every event except those awaiting new addresses", () => {
    const missing = events
      .filter((e) => (e.dashboardEmails ?? []).length === 0)
      .map((e) => e.name);
    expect(missing).toEqual(AWAITING_ADDRESSES);
  });

  it("does not let the awaiting list grow silently", () => {
    // One event without a coordinator login is a gap someone is covering by
    // hand. Several is a broken fest.
    expect(AWAITING_ADDRESSES.length).toBeLessThanOrEqual(1);
  });

  it("stores addresses lowercased, so role lookup matches", () => {
    const notLower = events
      .flatMap((e) => e.dashboardEmails ?? [])
      .filter((a) => a !== a.toLowerCase());
    expect(notLower).toEqual([]);
  });

  /* A comma or pipe left in an address is the failure mode this catches: the
     sheet is comma-separated, so a stray separator survives the paste and the
     coordinator can never match their real Google login. The old pattern used
     [^@\s]+, which happily accepts both. */
  it("gives each event at least one reachable address", () => {
    const bad = events
      .flatMap((e) => (e.dashboardEmails ?? []).map((a) => [e.name, a] as const))
      .filter(([, a]) => !/^[^@\s,;|]+@[^@\s,;|]+\.[^@\s,;|]{2,}$/.test(a));
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
