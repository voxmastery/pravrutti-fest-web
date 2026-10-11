import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  events, listedEvents, eventId, faqs, FEST, REGISTRATION_CLOSES_LONG, festFor, registrationState,
  capacityLabel,
} from "@/lib/pravrutti-data";
import { capOf, isFull } from "@/lib/event-full";
import { registerNoteText } from "@/lib/register-note";

/**
 * The deadline moved to 12 October; events shut on purpose stay shut.
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

/* Closed by hand on 10 Oct. Cap stays 45 (the desk held 44). full keeps
   it shut even with a place left. Listed, not taken off the list. */
describe("ROBO RACE", () => {
  it("takes no new teams and stays on the list", () => {
    const e = ev("ROBO RACE");
    expect(eventId(e.name)).toBe("robo-race");
    expect(e.maxTeams).toBe(45);
    expect(e.capacity).toBe(180);
    expect(e.full).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(e.registrationCloses).toBeUndefined();
    expect(capOf(e)).toEqual({ limit: 45, unit: "teams" });
    expect(capacityLabel(e)).toBe("45 teams");
    expect(isFull(e, { people: 0, teams: 0 })).toBe(true);
    expect(listedEvents).toContain(e);
  });
});

/* Closed by hand on 11 Oct. Cap stays the derived 40 (160 heads at four
   a team). full keeps it shut even with room left. Listed, not taken off
   the list. */
describe("Respawn", () => {
  it("takes no new teams and stays on the list", () => {
    const e = ev("Respawn");
    expect(eventId(e.name)).toBe("respawn");
    expect(e.maxTeams).toBeUndefined();
    expect(e.capacity).toBe(160);
    expect(e.full).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(e.registrationCloses).toBeUndefined();
    expect(capOf(e)).toEqual({ limit: 40, unit: "teams" });
    expect(capacityLabel(e)).toBe("40 teams");
    expect(isFull(e, { people: 0, teams: 0 })).toBe(true);
    expect(listedEvents).toContain(e);
  });
});

/* Cap is 52 teams: 42, then exactly 10 more on 10 Oct. No hand switch,
   so 51 holding places is open and 52 is full. */
describe("HAMMER", () => {
  it("is open below 52 teams and stays on the list until the fest close", () => {
    const e = ev("HAMMER");
    expect(eventId(e.name)).toBe("hammer");
    expect(e.maxTeams).toBe(52);
    expect(e.capacity).toBe(208);
    expect(e.full).toBeFalsy();
    expect(e.unlisted).toBeFalsy();
    expect(e.registrationCloses).toBeUndefined();
    expect(capOf(e)).toEqual({ limit: 52, unit: "teams" });
    expect(capacityLabel(e)).toBe("52 teams");
    expect(isFull(e, { people: 0, teams: 51 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 52 })).toBe(true);
    expect(listedEvents).toContain(e);
    expect(registrationState(Date.parse("2026-10-12T18:28:00.000Z"), festFor(e))).toBe("open");
    expect(registrationState(Date.parse("2026-10-12T18:29:00.000Z"), festFor(e))).toBe("closed");
  });
});

/* Cap is 16 teams: it had shut itself at 15, holding 14 confirmed and 1
   in review. One more team, then it fills. No hand switch. */
describe("FAULT x LOAD", () => {
  it("is open below 16 teams and stays on the list until the fest close", () => {
    const e = ev("FAULT x LOAD");
    expect(eventId(e.name)).toBe("fault-x-load");
    expect(e.maxTeams).toBe(16);
    expect(e.capacity).toBe(64);
    expect(e.full).toBeFalsy();
    expect(e.unlisted).toBeFalsy();
    expect(e.registrationCloses).toBeUndefined();
    expect(capOf(e)).toEqual({ limit: 16, unit: "teams" });
    expect(capacityLabel(e)).toBe("16 teams");
    expect(isFull(e, { people: 0, teams: 15 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 16 })).toBe(true);
    expect(listedEvents).toContain(e);
    expect(registrationState(Date.parse("2026-10-12T18:28:00.000Z"), festFor(e))).toBe("open");
    expect(registrationState(Date.parse("2026-10-12T18:29:00.000Z"), festFor(e))).toBe("closed");
  });
});

describe("the fest-wide deadline", () => {
  it("is 12 October, 11:59 PM IST", () => {
    expect(FEST.registrationCloses).toBe("2026-10-12T18:29:00.000Z");
    expect(Date.parse(FEST.registrationCloses!)).toBe(Date.parse("2026-10-12T23:59:00+05:30"));
  });

  it("is the date the FAQ gives", () => {
    const answer = faqs.find((f) => /last date/i.test(f.question))?.answer ?? "";
    expect(REGISTRATION_CLOSES_LONG).toMatch(/^12th October/);
    expect(answer).toContain(REGISTRATION_CLOSES_LONG);
    expect(answer).toContain("11:59 PM IST");
  });

  it("keeps an ordinary event open after the old 11 October date", () => {
    const afterNine = Date.parse("2026-10-10T06:00:00.000Z");
    expect(registrationState(afterNine, festFor(ev("ROBO RACE")))).toBe("open");
    expect(registrationState(afterNine, festFor(ev("Campus Innovators 2.0")))).toBe("open");
    expect(registrationState(Date.parse("2026-10-11T18:29:00.000Z"), festFor(ev("Campus Innovators 2.0")))).toBe("open");
    expect(registrationState(Date.parse("2026-10-12T18:29:00.000Z"), festFor(ev("Campus Innovators 2.0")))).toBe("closed");
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

/* Closed at 15 on 7 Oct, reopened the same day. Back to the pre-close
   field of 16 teams, listed, and taking new teams until that cap. */
describe("Kurukshetra – The Robo War", () => {
  it("is open at 16 teams and stays on the list", () => {
    const e = ev("KURUKSHETRA - THE ROBO WAR");
    expect(e.maxTeams).toBeUndefined();
    expect(e.capacity).toBe(64);
    expect(e.full).toBeFalsy();
    expect(isFull(e, { people: 0, teams: 0 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 15 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 16 })).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(listedEvents).toContain(e);
  });
});

/* Closed on 8 Oct, Rathan's call. No stated cap, so the hand switch is
   the shut — listed and struck through, the same way as RC-X. */
describe("Glide-X", () => {
  it("takes no new teams and stays on the list", () => {
    const e = ev("Glide-X");
    expect(eventId(e.name)).toBe("glide-x");
    expect(e.full).toBe(true);
    expect(e.capacity).toBeUndefined();
    expect(e.maxTeams).toBeUndefined();
    expect(isFull(e, { people: 0, teams: 0 })).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(listedEvents).toContain(e);
  });
});

/* Closed on 7 Oct at 19 teams: listed and struck through, not taken off
   the list. The desk held 14 confirmed and 5 in review, so 19 is the
   whole field and cuts nobody already in. */
describe("RC-X", () => {
  it("is capped at 19 teams, takes no new teams, and stays on the list", () => {
    const e = ev("RC-X");
    expect(e.maxTeams).toBe(19);
    expect(e.capacity).toBe(76);
    expect(e.full).toBe(true);
    expect(isFull(e, { people: 0, teams: 0 })).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(listedEvents).toContain(e);
  });
});

/* Closed by hand on 8 Oct, the same shut as RC-X and Robo War. The 60-team
   cap stays, so confirmed and in-review teams are not cut. full keeps it
   shut even with room under that cap. Listed, not taken off the list. */
describe("Pitch Pulse", () => {
  it("takes no new teams and stays on the list", () => {
    const e = ev("Pitch Pulse");
    expect(eventId(e.name)).toBe("pitch-pulse");
    expect(e.name).toBe("Pitch Pulse");
    expect(e.maxTeams).toBe(60);
    expect(e.capacity).toBe(240);
    expect(e.full).toBe(true);
    expect(e.unlisted).toBeFalsy();
    expect(capOf(e)).toEqual({ limit: 60, unit: "teams" });
    expect(capacityLabel(e)).toBe("60 teams");
    expect(isFull(e, { people: 0, teams: 0 })).toBe(true);
    expect(listedEvents).toContain(e);
  });
});

/* Raised from 25 to 30 teams on 8 Oct, Rathan and Aryan's ask. It had
   filled at 25 (23 confirmed, 2 in review), so five places reopen. No
   hand switch: new teams are taken until 30 or the fest deadline. */
describe("Terraform: The System Awakens", () => {
  it("closes on its own at 30 teams and stays open below that", () => {
    const e = ev("Terraform: The System Awakens");
    expect(eventId(e.name)).toBe("terraform-the-system-awakens");
    expect(e.name).toBe("Terraform: The System Awakens");
    expect(e.maxTeams).toBe(30);
    expect(e.capacity).toBe(120);
    expect(e.full).toBeFalsy();
    expect(e.unlisted).toBeFalsy();
    expect(capOf(e)).toEqual({ limit: 30, unit: "teams" });
    expect(capacityLabel(e)).toBe("30 teams");
    expect(isFull(e, { people: 77, teams: 25 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 29 })).toBe(false);
    expect(isFull(e, { people: 0, teams: 30 })).toBe(true);
    expect(listedEvents).toContain(e);
  });
});

/* Closed again on 8 Oct, Aailyah's request. Not switched to full: the
   events list says "Registrations closed", and teams already in — including
   the shortlist — keep their places. */
describe("Discoverize", () => {
  it("is closed on its own date, with no capacity and still on the list", () => {
    const e = ev("Discoverize (Research Paper Presentation)");
    expect(e.full).toBeFalsy();
    expect(e.capacity).toBeUndefined();
    expect(e.maxTeams).toBeUndefined();
    expect(e.registrationCloses).toBe("2026-10-08T01:30:00.000Z");
    expect(registrationState(Date.parse("2026-10-08T01:29:00.000Z"), festFor(e))).toBe("open");
    expect(registrationState(Date.parse("2026-10-08T01:30:00.000Z"), festFor(e))).toBe("closed");
    expect(isFull(e, { people: 0, teams: 0 })).toBe(false);
    expect(listedEvents).toContain(e);
  });

  it("is the only event with a note under Request to join", () => {
    const noted = events.filter((e) => e.registerNote).map((e) => e.name);
    expect(noted).toEqual(["Discoverize (Research Paper Presentation)"]);
    const e = ev("Discoverize (Research Paper Presentation)");
    /* The digits stay on the coordinators route. The events array only
       names who to ask, and the page fills the number in. */
    expect(e.registerNote).toBe(
      "Anyone joining on or after 7 Oct must join the WhatsApp group immediately and contact Aaliyah at {phone} for updates.",
    );
    expect(e.registerNote).not.toMatch(/\d{10}/);
    expect(e.registerNoteCoordinator).toBe("Aaliyah Aijaz Ali Khan");
    expect(registerNoteText(e.registerNote, e.registerNoteCoordinator, {
      "Aaliyah Aijaz Ali Khan": "8197092607",
    })).toBe(
      "Anyone joining on or after 7 Oct must join the WhatsApp group immediately and contact Aaliyah at 8197092607 for updates.",
    );
    expect(registerNoteText(e.registerNote, e.registerNoteCoordinator, {})).toBeNull();
  });
});

/* Paused on 5 Oct, reopened on 6 Oct. */
describe("DENT - INNOVATE", () => {
  it("takes entries again, and is listed", () => {
    expect(ev("DENT - INNOVATE").full).toBeFalsy();
    expect(isFull(ev("DENT - INNOVATE"), { people: 0, teams: 0 })).toBe(false);
    expect(listedEvents).toContain(ev("DENT - INNOVATE"));
  });
});

/* After 9 Oct and before 11 Oct 11:59 PM IST. Anything still shut here was
   shut on purpose, not by the fest-wide date. */
const DURING_EXTENSION = Date.parse("2026-10-10T06:00:00.000Z");
const STAYS_SHUT = [
  "CHAOS",
  "Hacktivate",
  "AI ESCAPE ROOM",
  "LINE FOLLOWER",
  "Pitch Pulse",
  "Glide-X",
  "RC-X",
  "ROBO RACE",
  "Respawn",
  "Discoverize (Research Paper Presentation)",
];

describe("the extension", () => {
  it("reopens every event the old deadline had shut, and no deliberate closure", () => {
    const shut = events
      .filter((e) => e.full || registrationState(DURING_EXTENSION, festFor(e)) !== "open")
      .map((e) => e.name)
      .sort();
    expect(shut).toEqual([...STAYS_SHUT].sort());
  });

  it("leaves the Robo Race cap and the Terraform cap where they are", () => {
    expect(ev("ROBO RACE").maxTeams).toBe(45);
    expect(ev("ROBO RACE").full).toBe(true);
    expect(ev("Terraform: The System Awakens").maxTeams).toBe(30);
    expect(ev("Terraform: The System Awakens").full).toBeFalsy();
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
