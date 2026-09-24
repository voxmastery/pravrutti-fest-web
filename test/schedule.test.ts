import { describe, it, expect } from "vitest";
import { scheduleDays, longRunning, scheduledEventIds, workshopSessions, accommodation, entryRowSpan } from "@/lib/schedule";
import { events, eventId } from "@/lib/pravrutti-data";

/* The schedule on this page used to be an image, and it went on showing the
   2025 roster long after the events changed. These are the checks that image
   could never have: the timetable and the event list must agree. */

const slugs = new Set(events.map((e) => eventId(e.name)));

describe("schedule", () => {
  it("only links to events that exist", () => {
    const unknown = scheduledEventIds().filter((id) => !slugs.has(id));
    expect(unknown).toEqual([]);
  });

  /* An event with no slot is one nobody can find a time for. */
  it("gives every event on the site a slot", () => {
    const scheduled = new Set(scheduledEventIds());
    const missing = [...slugs].filter((s) => !scheduled.has(s));
    expect(missing).toEqual([]);
  });

  it("never schedules the same event twice", () => {
    const ids = scheduledEventIds();
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("covers the three fest days", () => {
    expect(scheduleDays.map((d) => d.n)).toEqual([1, 2, 3]);
    for (const d of scheduleDays) expect(d.date).toMatch(/1[456] October 2026/);
  });

  it("gives every block a time and every entry something to print", () => {
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        expect(block.time.length).toBeGreaterThan(0);
        if (block.kind === "banner") expect(block.label.length).toBeGreaterThan(0);
        else if (block.kind === "workshop") {
          expect(block.club.length).toBeGreaterThan(0);
          expect(block.sessions.length).toBeGreaterThan(0);
        } else
          for (const e of block.entries) {
            expect(e.label.length).toBeGreaterThan(0);
            expect(e.track).toBeGreaterThanOrEqual(1);
            expect(e.track).toBeLessThanOrEqual(4);
          }
      }
    }
  });

  it("never puts two events in the same track in one block", () => {
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        if (block.kind !== "tracks") continue;
        const tracks = block.entries.map((e) => e.track);
        expect(tracks.length, `day ${day.n} ${block.time}`).toBe(new Set(tracks).size);
      }
    }
  });

  it("keeps the long-running events pointing at real pages", () => {
    for (const l of longRunning) expect(slugs.has(l.eventId)).toBe(true);
  });
});

/* Vidyut Sphura's workshops run beside the tracks rather than in one, so they
   are their own block kind. These pin the details the club gave us: a wrong
   speaker or a wrong hour on a printed timetable is the kind of error nobody
   catches until somebody is standing outside the wrong room. */
describe("workshops", () => {
  const all = workshopSessions();

  it("lists every session the club sent", () => {
    expect(all).toHaveLength(3);
    expect(all.map((w) => w.session.person)).toEqual([
      "Ms. Harita Balan",
      "Mrs. Rachana K",
      "Dr. Sanjeev K Nayak",
    ]);
  });

  it("puts the two automotive sessions back to back on day one", () => {
    const day1 = all.filter((w) => w.date === "14 October 2026");
    expect(day1.map((w) => w.session.time)).toEqual([
      "11:00 AM – 12:00 PM",
      "12:00 PM – 1:00 PM",
    ]);
    expect(day1[0].session.expertise).toBe("Automotive Embedded Systems & Cybersecurity");
    expect(day1[1].session.expertise).toBe("ADAS and Autonomous Driving Technologies");
  });

  it("puts the EV session on day two", () => {
    const day2 = all.filter((w) => w.date === "15 October 2026");
    expect(day2).toHaveLength(1);
    expect(day2[0].session).toMatchObject({
      person: "Dr. Sanjeev K Nayak",
      expertise: "EV Technologies",
      time: "11:00 AM – 1:00 PM",
    });
  });

  it("credits the club on every one of them", () => {
    for (const w of all) expect(w.club).toBe("Vidyut Sphura");
  });

  /* A workshop is not a fifth arena — it must never claim a track, or the
     grid would draw it competing with an event for the same cell. */
  it("never occupies a track", () => {
    for (const day of scheduleDays)
      for (const b of day.blocks)
        if (b.kind === "workshop") expect(b).not.toHaveProperty("entries");
  });

  it("does not disturb the event roster", () => {
    expect(scheduledEventIds().filter((id) => !slugs.has(id))).toEqual([]);
  });
});

describe("accommodation", () => {
  it("is offered, at the rate the committee set", () => {
    expect(accommodation.offered).toBe(true);
    expect(accommodation.ratePerHeadPerDay).toBe(450);
  });
});

/* A cell that outruns its block should occupy the rows beneath it, not print
   a time and leave a hole — the hole reads as "nothing is on", which is the
   opposite of the truth. The span is derived from the times rather than
   written down twice, so the two can never disagree. */
describe("row spans", () => {
  const day = (n: 1 | 2 | 3) => scheduleDays.find((d) => d.n === n)!;

  it("gives a normal entry a span of one", () => {
    expect(entryRowSpan(day(1), 1, 1)).toBe(1); // AI Escape Room, 11-2
  });

  it("carries Pitch Pulse down into the 5 PM row", () => {
    const blocks = day(1).blocks;
    const i = blocks.findIndex((b) => b.kind === "tracks" && b.time === "2:00 PM – 5:00 PM");
    expect(entryRowSpan(day(1), i, 4)).toBe(2);
  });

  it("carries Hammer and Kurukshetra down too", () => {
    const d2 = day(2).blocks.findIndex((b) => b.kind === "tracks" && b.time === "9:00 AM – 12:00 PM");
    expect(entryRowSpan(day(2), d2, 4)).toBe(2);
    const d3 = day(3).blocks.findIndex((b) => b.kind === "tracks" && b.time === "9:00 AM – 12:00 PM");
    expect(entryRowSpan(day(3), d3, 4)).toBe(2);
  });

  /* The row it grows into must be empty, or two events would claim one cell. */
  it("never swallows a cell another event is using", () => {
    for (const d of scheduleDays) {
      const tracks = d.blocks.map((b, i) => [b, i] as const).filter(([b]) => b.kind === "tracks");
      for (const [block, i] of tracks) {
        if (block.kind !== "tracks") continue;
        for (const e of block.entries) {
          const span = entryRowSpan(d, i, e.track);
          for (let k = 1; k < span; k++) {
            const below = d.blocks[i + k];
            expect(below?.kind).toBe("tracks");
            if (below?.kind === "tracks")
              expect(below.entries.find((x) => x.track === e.track)).toBeUndefined();
          }
        }
      }
    }
  });

  /* A workshop or a ceremony is a full-width row of its own; a span must stop
     at it rather than reach across and shove it sideways. */
  it("stops at a banner or a workshop row", () => {
    for (const d of scheduleDays) {
      for (let i = 0; i < d.blocks.length; i++) {
        const b = d.blocks[i];
        if (b.kind !== "tracks") continue;
        for (const e of b.entries) {
          const span = entryRowSpan(d, i, e.track);
          for (let k = 1; k < span; k++) expect(d.blocks[i + k].kind).toBe("tracks");
        }
      }
    }
  });

  it("agrees with what the cell prints", () => {
    const blocks = day(1).blocks;
    const i = blocks.findIndex((b) => b.kind === "tracks" && b.time === "2:00 PM – 5:00 PM");
    const b = blocks[i];
    if (b.kind !== "tracks") throw new Error("expected tracks");
    expect(b.entries.find((e) => e.track === 4)!.time).toBe("2:00 PM – 8:00 PM");
    expect(entryRowSpan(day(1), i, 4)).toBe(2);
  });
});
