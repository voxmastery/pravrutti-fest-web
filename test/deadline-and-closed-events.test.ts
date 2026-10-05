import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  events, listedEvents, eventId, faqs, FEST, REGISTRATION_CLOSES_LONG, festFor, registrationState,
} from "@/lib/pravrutti-data";
import { isFull } from "@/lib/event-full";

/**
 * The deadline moved to 9 October; four events are closed and hidden.
 *
 * On 5 Oct 2026 the organisers extended registration from 5 to 9 October,
 * and took CHAOS, Hacktivate, AI Escape Room and Line Follower out of it:
 * no new registrations, and gone from the events list so nobody new goes
 * looking. The people already registered, or in review, keep their places —
 * their event pages still open from their tickets, and their teams can
 * still take in teammates. Extending the fest-wide date must not quietly
 * reopen any of the four.
 */

const CLOSED = ["CHAOS", "Hacktivate", "AI ESCAPE ROOM", "LINE FOLLOWER"];
/* Hacktivate was hidden with the others, then put back on the list the same
   day — closed, but still shown. */
const HIDDEN = ["CHAOS", "AI ESCAPE ROOM", "LINE FOLLOWER"];
const ev = (name: string) => events.find((e) => e.name === name)!;
const AFTER_OLD_DEADLINE = Date.parse("2026-10-07T06:00:00.000Z"); // 7 Oct, 11:30 AM IST

describe("the fest-wide deadline", () => {
  it("is 9 October, 11:59 PM IST", () => {
    expect(FEST.registrationCloses).toBe("2026-10-09T18:29:59.000Z");
  });

  it("is the date the FAQ gives", () => {
    const answer = faqs.find((f) => /last date/i.test(f.question))?.answer ?? "";
    expect(REGISTRATION_CLOSES_LONG).toMatch(/^9th October/);
    expect(answer).toContain(REGISTRATION_CLOSES_LONG);
  });

  it("keeps an ordinary event open after the old 5 October date", () => {
    expect(registrationState(AFTER_OLD_DEADLINE, festFor(ev("ROBO RACE")))).toBe("open");
  });
});

describe("the four closed events", () => {
  for (const name of ["CHAOS", "AI ESCAPE ROOM", "LINE FOLLOWER"])
    it(`${name} takes no new teams, however few it holds`, () => {
      expect(isFull(ev(name), { people: 0, teams: 0 })).toBe(true);
    });

  /* Closed by its own earlier date rather than the switch; the extension
     must not carry it past that. */
  it("Hacktivate stays closed past the old deadline", () => {
    expect(registrationState(AFTER_OLD_DEADLINE, festFor(ev("Hacktivate")))).toBe("closed");
  });

  it("are left off the events list — all but Hacktivate — and nothing else is", () => {
    const hidden = events.filter((e) => !listedEvents.includes(e)).map((e) => e.name).sort();
    expect(hidden).toEqual([...HIDDEN].sort());
    expect(listedEvents).toContain(ev("Hacktivate"));
  });

  /* Hidden from the list, not deleted: registered students reach their
     event page from their ticket, so the page must still be built. */
  it("still have their own pages", () => {
    for (const name of CLOSED) expect(events.map((e) => eventId(e.name))).toContain(eventId(name));
  });
});

/* Paused, not hidden: it stays on the list, and takes no new entries. */
describe("DENT - INNOVATE", () => {
  it("takes no new entries, and is still listed", () => {
    expect(isFull(ev("DENT - INNOVATE"), { people: 0, teams: 0 })).toBe(true);
    expect(listedEvents).toContain(ev("DENT - INNOVATE"));
  });
});

describe("the events page", () => {
  const src = readFileSync(fileURLToPath(new URL("../app/events/page.tsx", import.meta.url)), "utf8");
  /* Organisers' decision, 5 Oct: closed events are shown, struck through and
     unclickable, rather than hidden. */
  it("lists every event, closed ones marked and not linked", () => {
    expect(src).toMatch(/allEvents\.filter\(matchesSearch\)/);
    expect(src).toMatch(/e\.full \|\| e\.unlisted/);
    expect(src).toMatch(/"Event is full"/);
    expect(src).toMatch(/aria-disabled="true"/);
  });
});
