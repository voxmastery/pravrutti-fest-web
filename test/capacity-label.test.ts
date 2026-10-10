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
    expect(e.capacity).toBe(64);
    expect(e.full).toBeFalsy();
  });

  it("RC-X reads 19 teams on the real data", () => {
    const e = events.find((x) => x.name === "RC-X")!;
    expect(capacityLabel(e)).toBe("19 teams");
    expect(e.maxTeams).toBe(19);
    expect(e.capacity).toBe(76);
    expect(e.full).toBe(true);
  });

  it("Pitch Pulse reads 60 teams on the real data", () => {
    const e = events.find((x) => x.name === "Pitch Pulse")!;
    expect(capacityLabel(e)).toBe("60 teams");
    expect(e.maxTeams).toBe(60);
    expect(e.capacity).toBe(240);
    expect(e.full).toBe(true);
  });

  it("Robo Race reads 45 teams on the real data", () => {
    const e = events.find((x) => x.name === "ROBO RACE")!;
    expect(capacityLabel(e)).toBe("45 teams");
    expect(e.maxTeams).toBe(45);
    expect(e.capacity).toBe(180);
    expect(e.full).toBe(true);
  });

  it("Fault x Load reads 16 teams on the real data", () => {
    const e = events.find((x) => x.name === "FAULT x LOAD")!;
    expect(capacityLabel(e)).toBe("16 teams");
    expect(e.maxTeams).toBe(16);
    expect(e.capacity).toBe(64);
    expect(e.full).toBeFalsy();
  });

  it("HAMMER reads 52 teams on the real data", () => {
    const e = events.find((x) => x.name === "HAMMER")!;
    expect(capacityLabel(e)).toBe("52 teams");
    expect(e.maxTeams).toBe(52);
    expect(e.capacity).toBe(208);
    expect(e.full).toBeFalsy();
  });

  it("Terraform reads 30 teams on the real data", () => {
    const e = events.find((x) => x.name === "Terraform: The System Awakens")!;
    expect(capacityLabel(e)).toBe("30 teams");
    expect(e.maxTeams).toBe(30);
    expect(e.capacity).toBe(120);
    expect(e.full).toBeFalsy();
  });
});

describe("capacityLabel — an explicit team cap", () => {
  /* Derivation guesses; a stated figure does not. maxTeams exists for the caps
     arithmetic cannot recover — TRIATHLON's 210 is 70 threes, and dividing by
     the max of four gives 52.5, which used to fall back to counting heads. */
  it("wins over the derivation", () => {
    const e = make({ capacity: 210, capacityUnit: "teams", maxTeams: 70, teamSize: { min: 3, max: 4, soloAllowed: false } });
    expect(capacityLabel(e)).toBe("70 teams");
  });

  it("wins even where the derivation would also work, so the stated number is what shows", () => {
    expect(capacityLabel(make({ capacity: 80, capacityUnit: "teams", maxTeams: 25 }))).toBe("25 teams");
  });

  it("says team, singular, for a field of one", () => {
    expect(capacityLabel(make({ capacity: 4, capacityUnit: "teams", maxTeams: 1 }))).toBe("1 team");
  });

  it("is ignored when zero or absent, rather than printing '0 teams'", () => {
    expect(capacityLabel(make({ capacity: 80, capacityUnit: "teams", maxTeams: 0 }))).toBe("20 teams");
  });

  /* The events whose caps are stated in people and allow solo entry: a team
     figure there would misstate the field, so they keep counting heads until
     the coordinators give a real team cap. */
  it("leaves solo-allowed, people-counted events showing participants", () => {
    const solo = make({ capacity: 60, capacityUnit: "participants", teamSize: { min: 1, max: 4, soloAllowed: true } });
    expect(capacityLabel(solo)).toBe("60 participants");
  });

  /* Discoverize was the other one until its cap was removed on 2 Oct. */
  it("no event still falls back to participants except the one known one", () => {
    const onHeads = events
      .filter((e) => (capacityLabel(e) ?? "").includes("participants"))
      .map((e) => e.name)
      .sort();
    expect(onHeads).toEqual(["DENT - INNOVATE"]);
  });
});
