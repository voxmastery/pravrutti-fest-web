import { describe, it, expect } from "vitest";
import {
  DEFAULT_ACCESS,
  applyAccess,
  applyAction,
  coordinatorDashboardOn,
  isValidEmail,
  readAccess,
  type AccessConfig,
} from "@/lib/access-control";

/* Organiser is the most privileged role here — it verifies payments and reads
   every applicant's contact details — so these pin the two things that must
   never go wrong: a stored record can only ever ADD access, and the dashboard
   can never be used to lock every organiser out of it. */

const base = (over: Partial<AccessConfig> = {}): AccessConfig => ({ ...DEFAULT_ACCESS, ...over });
const granted = (email: string): AccessConfig =>
  base({ organisers: [{ email, addedBy: "boss@example.com", addedAt: "2026-09-17T00:00:00.000Z" }] });

describe("applyAccess", () => {
  it("promotes someone granted in the record", () => {
    expect(applyAccess({ kind: "none" }, "new@example.com", granted("new@example.com"))).toEqual({
      kind: "organiser",
    });
  });

  it("matches the address case- and space-insensitively", () => {
    expect(applyAccess({ kind: "none" }, "  NEW@Example.com ", granted("new@example.com")).kind).toBe("organiser");
  });

  /* The rule that makes a bad write survivable: stored access never subtracts
     from what env already gave. */
  it("never demotes an organiser", () => {
    expect(applyAccess({ kind: "organiser" }, "boss@example.com", DEFAULT_ACCESS)).toEqual({ kind: "organiser" });
  });

  it("gives a coordinator no events while dashboards are off", () => {
    const role = applyAccess({ kind: "coordinator", eventIds: ["robo-race"] }, "c@example.com", DEFAULT_ACCESS);
    expect(role).toEqual({ kind: "coordinator", eventIds: [] });
  });

  it("gives a coordinator their events once dashboards are on", () => {
    const access = base({ coordinatorsEnabled: true });
    const role = applyAccess({ kind: "coordinator", eventIds: ["robo-race", "chaos"] }, "c@example.com", access);
    expect(role).toEqual({ kind: "coordinator", eventIds: ["robo-race", "chaos"] });
  });

  it("drops just the events switched off individually", () => {
    const access = base({ coordinatorsEnabled: true, coordinatorsDisabledEventIds: ["chaos"] });
    const role = applyAccess({ kind: "coordinator", eventIds: ["robo-race", "chaos"] }, "c@example.com", access);
    expect(role).toEqual({ kind: "coordinator", eventIds: ["robo-race"] });
  });

  it("leaves a stranger with nothing", () => {
    expect(applyAccess({ kind: "none" }, "nobody@example.com", granted("other@example.com"))).toEqual({ kind: "none" });
  });

  it("promotes a desk volunteer from a registration grant", () => {
    const access = base({
      registration: [{ email: "desk@example.com", addedBy: "boss@example.com", addedAt: "2026-10-12T00:00:00.000Z" }],
    });
    expect(applyAccess({ kind: "none" }, "desk@example.com", access)).toEqual({ kind: "registration" });
  });

  it("never demotes an organiser or coordinator to registration", () => {
    const access = base({
      registration: [{ email: "boss@example.com", addedBy: "x@y.com", addedAt: "t" }],
    });
    expect(applyAccess({ kind: "organiser" }, "boss@example.com", access).kind).toBe("organiser");
    const coordAccess = base({
      coordinatorsEnabled: true,
      registration: [{ email: "c@example.com", addedBy: "x@y.com", addedAt: "t" }],
    });
    expect(
      applyAccess({ kind: "coordinator", eventIds: ["robo-race"] }, "c@example.com", coordAccess)
    ).toEqual({ kind: "coordinator", eventIds: ["robo-race"] });
  });
});

describe("coordinatorDashboardOn", () => {
  it("is off when the master switch is off, whatever the per-event list says", () => {
    expect(coordinatorDashboardOn(base({ coordinatorsEnabled: false }), "robo-race")).toBe(false);
  });
  it("is on when the master is on and the event is not excluded", () => {
    expect(coordinatorDashboardOn(base({ coordinatorsEnabled: true }), "robo-race")).toBe(true);
  });
});

describe("applyAction", () => {
  it("adds an organiser and records who did it", () => {
    const out = applyAction(DEFAULT_ACCESS, { type: "add_organiser", email: " New@Example.com " }, "boss@example.com");
    expect("access" in out).toBe(true);
    if (!("access" in out)) return;
    expect(out.access.organisers[0]).toMatchObject({ email: "new@example.com", addedBy: "boss@example.com" });
    expect(out.access.organisers[0].addedAt).toBeTruthy();
  });

  it("refuses an address that is not one", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", "a@b.com,c@d.com"])
      expect(applyAction(DEFAULT_ACCESS, { type: "add_organiser", email: bad }, "boss@example.com")).toHaveProperty("error");
  });

  it("refuses a duplicate", () => {
    expect(
      applyAction(granted("new@example.com"), { type: "add_organiser", email: "new@example.com" }, "boss@example.com")
    ).toHaveProperty("error");
  });

  it("removes a granted organiser", () => {
    const out = applyAction(granted("new@example.com"), { type: "remove_organiser", email: "new@example.com" }, "boss@example.com");
    expect("access" in out && out.access.organisers).toEqual([]);
  });

  /* The lockout guard: env organisers are not in the record, so the dashboard
     cannot remove them and someone always retains the keys. */
  it("cannot remove an organiser it did not grant", () => {
    expect(
      applyAction(DEFAULT_ACCESS, { type: "remove_organiser", email: "boss@example.com" }, "boss@example.com")
    ).toHaveProperty("error");
  });

  it("flips the master coordinator switch", () => {
    const on = applyAction(DEFAULT_ACCESS, { type: "set_coordinators", enabled: true }, "boss@example.com");
    expect("access" in on && on.access.coordinatorsEnabled).toBe(true);
  });

  it("switches one event off and back on without touching the rest", () => {
    const off = applyAction(base({ coordinatorsEnabled: true }), { type: "set_event_coordinator", eventId: "chaos", enabled: false }, "b@e.com");
    expect("access" in off && off.access.coordinatorsDisabledEventIds).toEqual(["chaos"]);
    if (!("access" in off)) return;
    const on = applyAction(off.access, { type: "set_event_coordinator", eventId: "chaos", enabled: true }, "b@e.com");
    expect("access" in on && on.access.coordinatorsDisabledEventIds).toEqual([]);
  });

  it("never records the same event twice when switched off repeatedly", () => {
    let acc = base({ coordinatorsEnabled: true });
    for (let i = 0; i < 3; i++) {
      const r = applyAction(acc, { type: "set_event_coordinator", eventId: "chaos", enabled: false }, "b@e.com");
      if ("access" in r) acc = r.access;
    }
    expect(acc.coordinatorsDisabledEventIds).toEqual(["chaos"]);
  });

  it("adds and removes a registration desk volunteer", () => {
    const added = applyAction(DEFAULT_ACCESS, { type: "add_registration", email: " Desk@Example.com " }, "boss@example.com");
    expect("access" in added).toBe(true);
    if (!("access" in added)) return;
    expect(added.access.registration[0]).toMatchObject({ email: "desk@example.com", addedBy: "boss@example.com" });
    const removed = applyAction(added.access, { type: "remove_registration", email: "desk@example.com" }, "boss@example.com");
    expect("access" in removed && removed.access.registration).toEqual([]);
  });

  it("refuses a duplicate desk grant", () => {
    const access = base({
      registration: [{ email: "desk@example.com", addedBy: "b", addedAt: "t" }],
    });
    expect(
      applyAction(access, { type: "add_registration", email: "desk@example.com" }, "boss@example.com")
    ).toHaveProperty("error");
  });
});

describe("readAccess", () => {
  /* Role resolution runs on every dashboard request; a half-written record must
     degrade to "grants nothing" rather than throw and lock everyone out. */
  it("falls back to granting nothing on junk", () => {
    for (const junk of [null, undefined, 42, "nope", {}, { organisers: "no" }])
      expect(readAccess(junk)).toEqual(DEFAULT_ACCESS);
  });

  it("drops grant entries that are not real addresses", () => {
    const out = readAccess({ organisers: [{ email: "nope" }, { email: "ok@example.com", addedBy: "b", addedAt: "t" }] });
    expect(out.organisers.map((g) => g.email)).toEqual(["ok@example.com"]);
  });

  it("treats a missing coordinator switch as off", () => {
    expect(readAccess({ organisers: [] }).coordinatorsEnabled).toBe(false);
  });

  it("reads an older record without a registration list", () => {
    expect(readAccess({ organisers: [] }).registration).toEqual([]);
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address and rejects list separators", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("a@b.com;c@d.com")).toBe(false);
    expect(isValidEmail("a@b.com c@d.com")).toBe(false);
  });
});
