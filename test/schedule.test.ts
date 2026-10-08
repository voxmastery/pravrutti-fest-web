import { describe, it, expect } from "vitest";
import { scheduleDays, longRunning, scheduledEventIds, workshopSessions, workshops, accommodation, entryRowSpan } from "@/lib/schedule";
import { events, eventId, eventWhen } from "@/lib/pravrutti-data";

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
    const day1 = all.filter((w) => w.date === "14 October");
    expect(day1.map((w) => w.session.time)).toEqual([
      "11:00 AM – 12:00 PM",
      "12:00 PM – 1:00 PM",
    ]);
    expect(day1[0].session.expertise).toBe("Automotive Embedded Systems & Cybersecurity");
    expect(day1[1].session.expertise).toBe("ADAS and Autonomous Driving Technologies");
  });

  it("puts the EV session on day two", () => {
    const day2 = all.filter((w) => w.date === "15 October");
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

  /* They sit beside the tracks, not inside a day. Putting them back into a
     day is what confused people the first time: a band between two track
     rows reads as a slot that blocks the events either side of it. */
  it("lives beside the tracks, not inside a day", () => {
    for (const day of scheduleDays)
      for (const b of day.blocks) expect(["banner", "tracks"]).toContain(b.kind);
    expect(workshops.length).toBeGreaterThan(0);
  });

  it("does not disturb the event roster", () => {
    expect(scheduledEventIds().filter((id) => !slugs.has(id))).toEqual([]);
  });
});

describe("accommodation", () => {
  it("is offered, at the rate the committee set", () => {
    expect(accommodation.offered).toBe(true);
    expect(accommodation.ratePerHeadPerDay).toBe(1000);
  });

  /* A rate with nobody to ring is half an answer — somebody reading this is
     deciding whether they can come at all. */
  it("says who to call to book one", () => {
    expect(accommodation.contacts).toHaveLength(2);
    expect(accommodation.contacts.map((c) => c.name)).toEqual(["Rathan Raj", "Shreya"]);
    for (const c of accommodation.contacts) expect(c.phone).toMatch(/^[6-9]\d{9}$/);
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
    expect(entryRowSpan(day(1), i, 3)).toBe(2);
  });

  it("carries Hammer and Kurukshetra down too", () => {
    const d2 = day(2).blocks.findIndex((b) => b.kind === "tracks" && b.time === "9:00 AM – 12:00 PM");
    /* Hammer runs to 3:00 PM, through the noon row. The next row is the
       Under25 banner, so the span stops there. */
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

  /* A ceremony is a full-width row of its own; a span must stop at it rather
     than reach across and shove it sideways. */
  it("stops at a banner row", () => {
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
    const pulse = b.entries.find((e) => e.eventId === "pitch-pulse")!;
    expect(pulse.track).toBe(3);
    expect(pulse.time).toBe("2:00 PM – 8:00 PM");
    expect(b.entries.find((e) => e.track === 4)).toBeUndefined();
    expect(entryRowSpan(day(1), i, 3)).toBe(2);
    const evening = blocks.find((x) => x.kind === "tracks" && x.time === "5:00 PM – 8:00 PM");
    if (evening?.kind !== "tracks") throw new Error("expected tracks");
    expect(evening.entries.find((e) => e.track === 3 || e.track === 4)).toBeUndefined();
  });
});

/* Moved on 6 Oct 2026 from 14 Oct, 2:00 PM to 15 Oct, 2:30 PM, then out of
   the track grid on 8 Oct into the alongside rows with Hacktivate and Chaos.
   The timetable, the event page and the event's own rules must agree. */
describe("DENT - INNOVATE's slot", () => {
  it("runs alongside on 15 October from 2:30 PM, not inside a track", () => {
    const inTracks = scheduleDays.flatMap((d) =>
      d.blocks.flatMap((b) =>
        b.kind === "tracks" && b.entries.some((e) => e.eventId === "dent-innovate") ? [d.date] : [],
      ),
    );
    expect(inTracks).toEqual([]);
    expect(longRunning.filter((l) => l.eventId === "dent-innovate")).toEqual([
      {
        date: "15 October",
        time: "2:30 PM – 5:30 PM",
        eventId: "dent-innovate",
        label: "Dent Innovate",
        host: "IIC",
      },
    ]);
  });

  it("is what its event page says", () => {
    const dent = events.find((e) => eventId(e.name) === "dent-innovate")!;
    expect(eventWhen(dent)).toEqual({ line: "Thu, 15 Oct, 2:30 PM", exact: true });
  });

  it("is when its rules say presentations begin", () => {
    const dent = events.find((e) => eventId(e.name) === "dent-innovate")!;
    expect(dent.description).toMatch(/Presentations begin at 2:30 pm on 15 October/);
    expect(dent.description).not.toMatch(/begin at 2:00 pm/);
  });
});
