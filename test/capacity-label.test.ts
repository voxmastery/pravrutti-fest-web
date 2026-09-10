import { describe, it, expect } from "vitest";
import { capacityLabel, events, type Event } from "@/lib/pravrutti-data";

const make = (over: Partial<Event>): Event =>
  ({
    name: "T",
    category: "Code and Compute",
    subCategory: "",
    description: "",
    fee: "Rs. 200/-",
    prizes: [],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    coordinators: { faculty: [], student: [] },
    ...over,
  }) as Event;

describe("capacityLabel", () => {
  /* capacity is a head count — the sheet's "Max Participants". A team-run
     event states it as "20 teams x 4 = 80", so showing the raw 80 next to the
     word "teams" claims four times the field. */
  it("converts a team-counted head count into the number of teams", () => {
    expect(capacityLabel(make({ capacity: 64, capacityUnit: "teams" }))).toBe("16 teams");
    expect(capacityLabel(make({ capacity: 80, capacityUnit: "teams" }))).toBe("20 teams");
  });

  it("respects a smaller max team size", () => {
    expect(
      capacityLabel(make({ capacity: 120, capacityUnit: "teams", teamSize: { min: 2, max: 3, soloAllowed: false } }))
    ).toBe("40 teams");
  });

  it("says one team, not 1 teams", () => {
    expect(capacityLabel(make({ capacity: 4, capacityUnit: "teams" }))).toBe("1 team");
  });

  /* TRIATHLON is 210 with a max of 4, which is 52.5 teams. Rounding would
     invent or destroy a place, so it reports the head count it actually knows. */
  it("falls back to participants when the head count is not a whole number of teams", () => {
    expect(capacityLabel(make({ capacity: 210, capacityUnit: "teams" }))).toBe("210 participants");
  });

  it("leaves a participant-counted capacity alone", () => {
    expect(capacityLabel(make({ capacity: 60, capacityUnit: "participants" }))).toBe("60 participants");
  });

  it("is null when no cap was given, so the UI omits the row", () => {
    expect(capacityLabel(make({ capacity: undefined }))).toBeNull();
  });

  it("never labels a solo event in teams", () => {
    expect(
      capacityLabel(make({ capacity: 50, capacityUnit: "teams", teamSize: { min: 1, max: 1, soloAllowed: true } }))
    ).toBe("50 participants");
  });

  it("Robo War reads 16 teams on the real data", () => {
    const e = events.find((x) => x.name === "KURUKSHETRA - THE ROBO WAR")!;
    expect(capacityLabel(e)).toBe("16 teams");
  });
});
