import { describe, it, expect } from "vitest";
import { parseDescription } from "@/lib/event-description";
import { events } from "@/lib/pravrutti-data";

describe("parseDescription", () => {
  it("leaves a plain paragraph alone", () => {
    const r = parseDescription("One sentence. Then another.");
    expect(r.intro).toBe("One sentence. Then another.");
    expect(r.bullets).toEqual([]);
  });

  /* The sheet pastes bullets inline, mid-sentence, rather than on their own
     line — so splitting on newlines would miss every one of them. */
  it("splits bullets that appear inline in a single run of text", () => {
    const r = parseDescription("Intro text. ●  Round 1: does a thing ●  Round 2: does another");
    expect(r.intro).toBe("Intro text.");
    expect(r.bullets).toEqual(["Round 1: does a thing", "Round 2: does another"]);
  });

  it("splits bullets written on their own lines", () => {
    const r = parseDescription("Intro.\n- First\n- Second");
    expect(r.intro).toBe("Intro.");
    expect(r.bullets).toEqual(["First", "Second"]);
  });

  it("handles a description that is only bullets, with no intro", () => {
    const r = parseDescription("● Alpha ● Beta");
    expect(r.intro).toBeNull();
    expect(r.bullets).toEqual(["Alpha", "Beta"]);
  });

  it("collapses the runs of padding spaces the sheet leaves behind", () => {
    const r = parseDescription("●        Round 1     spaced   out");
    expect(r.bullets).toEqual(["Round 1 spaced out"]);
  });

  it("does not treat a hyphenated word or a minus sign as a bullet", () => {
    const r = parseDescription("Teams build a load-bearing bridge - then test it.");
    expect(r.bullets).toEqual([]);
    expect(r.intro).toContain("load-bearing");
  });

  it("turns the three real events with inline bullets into lists", () => {
    for (const name of ["Campus Innovators 2.0", "Beyond the Blueprint 2.0", "TRIATHLON"]) {
      const e = events.find((x) => x.name === name)!;
      const r = parseDescription(e.description);
      expect(r.bullets.length, `${name} should have bullets`).toBeGreaterThanOrEqual(2);
      expect(r.bullets.join(" ")).not.toContain("●");
    }
  });

  it("lets Hacktivate teams bring their own components", () => {
    const e = events.find((x) => x.name === "Hacktivate")!;
    expect(e.description).toContain(
      "Teams may bring and use their own components. A PCB Cupid kit is available on site for Track 1 (Seconds Ahead).",
    );
    expect(e.description).not.toMatch(/on-site stall|sourced on-site|component procurement|components are provided|kit-only|must use the PCB Cupid kit/i);
    expect(e.description).toContain("Meals, overnight refreshments, and a supervised rest area are provided.");
    expect(e.description).toContain("Six judges sit, two per track.");
    expect(e.description).toContain("about five minutes at the table");
    expect(e.description).toContain("a combined final is held before all six judges");
    expect(e.description).toContain("The rubric is out of 20, and creativity is the tie-breaker.");
    expect(e.description).toContain("14 October 2026, 11:00 AM to 15 October 2026, 11:00 AM");
    expect(e.description).toContain("15 October 2026, 9:00–11:00 AM");
    expect(e.brochureUrl).toBe("/hacktivate-rules.pdf");
    const seeed = e.sponsorPerks?.find((p) => p.sponsor === "Seeed Studio");
    expect(seeed?.perks).toContain("Best Voice AI Build, prize by reSpeaker (Seeed Studio)");
  });

  it("gives ElectroXcape an intro and one bullet per round", () => {
    const e = events.find((x) => x.name === "ELECTROXCAPE")!;
    const r = parseDescription(e.description);
    expect(r.intro).toBeTruthy();
    expect(r.bullets.length).toBe(5);
    expect(r.bullets[0]).toMatch(/^Round 1/);
  });
});
