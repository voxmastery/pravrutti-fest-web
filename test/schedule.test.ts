import { describe, it, expect } from "vitest";
import { scheduleDays, longRunning, scheduledEventIds, workshopSessions, accommodation } from "@/lib/schedule";
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
