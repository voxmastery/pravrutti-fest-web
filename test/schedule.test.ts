import { describe, it, expect } from "vitest";
import { scheduleDays, longRunning, scheduledEventIds } from "@/lib/schedule";
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
        else
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
