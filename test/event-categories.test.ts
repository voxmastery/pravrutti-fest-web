import { describe, it, expect } from "vitest";
import { events, type Event } from "@/lib/pravrutti-data";

/* The five tracks the organisers named, and exactly which events belong to
   each. Pinned here because the grouping is editorial — nothing in the data
   derives it, so a rename or a new event could silently land in the wrong
   track and nobody would notice until a participant filtered for it. */
const TRACKS: Record<Event["category"], string[]> = {
  MACHINA: [
    "ROBO RACE",
    "LINE FOLLOWER",
    "KURUKSHETRA - THE ROBO WAR",
    "FAULT x LOAD",
    "BRIDGE IT",
    "Bracket blitz",
    "Glide-X",
    "RC-X",
  ],
  TECHNOVERSE: ["Hacktivate", "CHAOS", "HAMMER"],
  "CODE & CHAOS": [
    "Terraform: The System Awakens",
    "Respawn",
    "The Logic Circuit",
    "AI ESCAPE ROOM",
    "ZERO HOUR",
    "TRIATHLON",
    "ELECTROXCAPE",
  ],
  INNOVENTURE: ["Discoverize (Research Paper Presentation)", "DENT - INNOVATE", "PITCH AT MACH"],
  IDEAFORGE: [
    "Campus Innovators 2.0",
    "Beyond the Blueprint 2.0",
    "LEADS Innovation Challenge",
    "Pitch Pulse",
  ],
};

const norm = (s: string) => s.trim().toLowerCase();

describe("event tracks", () => {
  it("covers every event exactly once", () => {
    const listed = Object.values(TRACKS).flat();
    expect(listed).toHaveLength(events.length);
    expect(new Set(listed.map(norm)).size).toBe(listed.length);
  });

  it("puts every event in the track the organisers named", () => {
    for (const [track, names] of Object.entries(TRACKS)) {
      for (const name of names) {
        const e = events.find((x) => norm(x.name) === norm(name));
        expect(e, `no event named ${name}`).toBeDefined();
        expect(e!.category, `${name} is in the wrong track`).toBe(track);
      }
    }
  });

  it("uses only the five track names", () => {
    const used = new Set(events.map((e) => e.category));
    expect([...used].sort()).toEqual(Object.keys(TRACKS).sort());
  });

  it("has the counts the chips will show", () => {
    const counts = Object.fromEntries(
      Object.keys(TRACKS).map((t) => [t, events.filter((e) => e.category === t).length])
    );
    expect(counts).toEqual({
      MACHINA: 8,
      TECHNOVERSE: 3,
      "CODE & CHAOS": 7,
      INNOVENTURE: 3,
      IDEAFORGE: 4,
    });
  });
});
