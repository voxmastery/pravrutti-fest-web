import { describe, it, expect, beforeAll } from "vitest";

/* Covers faculty and student together: the page renders them in one list and
   /api/events/coordinators returns one flat set of numbers, so a faculty
   entry is just as able to drift out of sync.

   coordinator-phones.ts matches the public coordinator list by exact name
   string, and its own comment warns that editing a name in one file without
   the other "quietly stops" that person's call button appearing. Until now
   nothing enforced that — this is the enforcement. */
let events: typeof import("@/lib/pravrutti-data").events;
let eventId: typeof import("@/lib/pravrutti-data").eventId;
let coordinatorPhones: typeof import("@/lib/coordinator-phones").coordinatorPhones;

beforeAll(async () => {
  ({ events, eventId } = await import("@/lib/pravrutti-data"));
  ({ coordinatorPhones } = await import("@/lib/coordinator-phones"));
});

describe("coordinator phone entries match coordinator names", () => {
  it("has no phone entry whose name matches nobody on that event", () => {
    const orphans: string[] = [];
    for (const e of events) {
      const listed = new Set(
        [...e.coordinators.faculty, ...e.coordinators.student].map((c) => c.name)
      );
      for (const p of coordinatorPhones(eventId(e.name))) {
        if (!listed.has(p.name)) orphans.push(`${e.name}: "${p.name}"`);
      }
    }
    // An orphan is a number nobody can reach — the name drifted in one file.
    expect(orphans).toEqual([]);
  });

  /* The reverse is allowed but worth seeing: a coordinator with no phone entry
     simply gets no call button. That is the state newly-added coordinators are
     in until their numbers arrive, so this reports rather than fails. */
  it("reports coordinators who currently have no reachable number", () => {
    const noPhone: string[] = [];
    for (const e of events) {
      const phones = new Set(coordinatorPhones(eventId(e.name)).map((p) => p.name));
      for (const c of [...e.coordinators.faculty, ...e.coordinators.student]) {
        if (!phones.has(c.name)) noPhone.push(`${e.name}: ${c.name}`);
      }
    }
    expect(noPhone).toEqual([
      "ELECTROXCAPE: K S Aashritha Reddy",
      "ELECTROXCAPE: Spoorthi K",
      "ELECTROXCAPE: Sanketh Rao",
      "ELECTROXCAPE: Prachi Joshi",
    ]);
  });
});
