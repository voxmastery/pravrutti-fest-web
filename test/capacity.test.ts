import { describe, it, expect } from "vitest";
import {
  capacityFor,
  capacityInPeople,
  DEFAULT_CAPACITY,
  eventId,
  events,
  EVENT_CAPACITY,
  type Event,
} from "@/lib/pravrutti-data";

const make = (over: Partial<Event>): Event =>
  ({
    name: "T",
    category: "Code and Compute",
    subCategory: "",
    description: "",
    fee: "Rs. 200/-",
    prizes: [1000],
    teamSize: { min: 1, max: 4, soloAllowed: true },
    capacityUnit: "participants",
    coordinators: { faculty: [], student: [] },
    brochureUrl: "",
    ...over,
  }) as Event;

/**
 * The trap here is the opposite of what it first looks like.
 *
 * "Capacity Counts" in the sheet says things like "20 teams × 4", which reads
 * as a team cap — but the "Max Participants" column beside it already holds
 * the product (80). Multiplying by team size quadruples every team event; an
 * earlier version did exactly that and reported 8,830 places for a fest with
 * 2,235.
 */
describe("capacityInPeople", () => {
  it("treats a team-counted capacity as the head count it already is", () => {
    // ROBO RACE in the real sheet: Max Participants 80, "20 teams × 4".
    expect(
      capacityInPeople(
        make({ capacity: 80, capacityUnit: "teams", teamSize: { min: 2, max: 4, soloAllowed: false } })
      )
    ).toBe(80);
  });

  it("leaves a participant-counted capacity alone", () => {
    expect(capacityInPeople(make({ capacity: 30, capacityUnit: "participants" }))).toBe(30);
  });

  it("returns null when no cap was given, so the UI omits the denominator", () => {
    expect(capacityInPeople(make({ capacity: undefined }))).toBeNull();
  });

  it("keeps the fest total in a plausible range for a 24-event fest", () => {
    // A regression of the ×4 bug would push this well past 8,000.
    const total = events.reduce((s, e) => s + (capacityInPeople(e) ?? 0), 0);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(4000);
  });

  it("never exceeds the coordinators' own stated maximum", () => {
    for (const e of events) {
      const people = capacityInPeople(e);
      if (people === null || !e.capacity) continue;
      expect(people).toBe(e.capacity);
    }
  });
});

/**
 * The registration meter and the event panel must quote the same number.
 * capacityFor used to return a blanket 100 for every event, so ROBO RACE
 * showed "Capacity 80" in one panel and "0 of 100 seats" in the other.
 */
describe("capacityFor", () => {
  it("uses the event's own capacity from the coordinators' sheet", () => {
    expect(capacityFor(eventId("ROBO RACE"))).toBe(80);
  });

  it("agrees with capacityInPeople for every capped event", () => {
    for (const e of events) {
      const people = capacityInPeople(e);
      if (people === null) continue;
      const id = eventId(e.name);
      if (id in EVENT_CAPACITY) continue; // explicit override wins by design
      expect(capacityFor(id)).toBe(people);
    }
  });

  it("falls back to the default only when an event gave no cap", () => {
    expect(capacityFor("no-such-event")).toBe(DEFAULT_CAPACITY);
  });
});
