import { describe, it, expect } from "vitest";
import { events, clubs, clubFor, eventId } from "@/lib/pravrutti-data";
import { deskEmailsFor } from "@/lib/dashboard-access";

/* "Hosted by" names the organising club. A wrong club on a public page is
   worse than none, so Event.club is set only where the repo says so outright —
   these tests exist to stop a future edit from filling the gaps by guessing. */

describe("club attribution", () => {
  it("only ever names a club that exists in the clubs list", () => {
    const known = new Set(clubs.map((c) => c.name));
    for (const e of events) {
      if (e.club) expect(known, `${e.name} names an unknown club`).toContain(e.club);
    }
  });

  it("attaches the club's own tagline, so the UI never invents one", () => {
    for (const e of events) {
      const club = clubFor(e);
      if (!club) continue;
      const listed = clubs.find((c) => c.name === club.name);
      expect(club.tagline).toBe(listed?.tagline);
    }
  });

  it("returns null for an event with no attribution rather than a placeholder", () => {
    const unattributed = events.filter((e) => !e.club);
    expect(unattributed.length).toBeGreaterThan(0);
    for (const e of unattributed) expect(clubFor(e)).toBeNull();
  });

  it("credits IEEE with the two hackathons whose own descriptions say so", () => {
    for (const slug of ["CHAOS", "Hacktivate"]) {
      const e = events.find((ev) => ev.name === slug);
      expect(e?.description).toContain("IEEE Student Branch");
      expect(e?.club).toBe("IEEE");
    }
  });

  it("credits the Ramaiah Civil Club with the event run from its own address", () => {
    const e = events.find((ev) => ev.name === "BRIDGE IT");
    expect(deskEmailsFor(eventId(e!.name)).some((m) => m.includes("civilclub"))).toBe(true);
    expect(e?.club).toBe("Ramaiah Civil Club");
  });
});
