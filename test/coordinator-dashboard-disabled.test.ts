import { describe, it, expect } from "vitest";
import { COORDINATOR_DASHBOARD_ENABLED, roleForEmail, canViewEvent } from "@/lib/roles";
import { staffBlocksApplication } from "@/lib/staff-cockpit";
import { events, eventId } from "@/lib/pravrutti-data";

/* Coordinator dashboards are switched off. The shape of "off" matters: they
   keep their staff identity but hold no event, so no dashboard route hands
   them data — while the rule that staff cannot register for events survives.
   Demoting them to "none" instead would have quietly unlocked that. */

/** A real coordinator address from the event data, so this tracks the roster. */
const coordinatorEmail = (() => {
  for (const e of events) {
    const first = (e.dashboardEmails ?? [])[0];
    if (first) return { email: first, evId: eventId(e.name) };
  }
  throw new Error("no coordinator addresses in the event data");
})();

describe("coordinator dashboards, while switched off", () => {
  it("is actually off", () => {
    expect(COORDINATOR_DASHBOARD_ENABLED).toBe(false);
  });

  it("still recognises them as a coordinator", () => {
    expect(roleForEmail(coordinatorEmail.email).kind).toBe("coordinator");
  });

  it("gives them access to no event at all", () => {
    const role = roleForEmail(coordinatorEmail.email);
    expect(role.kind === "coordinator" && role.eventIds).toEqual([]);
    // Not even the event they actually run.
    expect(canViewEvent(role, coordinatorEmail.evId)).toBe(false);
  });

  /* The reason this is not a demotion to "none": staff must still not be able
     to register for the event they run. */
  it("still stops them registering for events", () => {
    const kind = roleForEmail(coordinatorEmail.email).kind;
    expect(staffBlocksApplication(kind, "none")).toBe(true);
    expect(staffBlocksApplication("none", kind)).toBe(true);
  });

  it("leaves organisers untouched", () => {
    expect(canViewEvent({ kind: "organiser" }, coordinatorEmail.evId)).toBe(true);
  });

  it("still gives a stranger nothing", () => {
    expect(roleForEmail("nobody@example.com").kind).toBe("none");
  });
});
