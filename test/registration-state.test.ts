import { describe, it, expect } from "vitest";
import {
  FEST,
  registrationState,
  registrationOpen,
  registrationUnavailableMessage,
} from "@/lib/pravrutti-data";

/* The boundaries are tested against explicit fest objects rather than FEST
   itself, so the rule stays covered whatever the committee announces — FEST
   currently carries no closing date at all. */
const day = 24 * 60 * 60 * 1000;
const closes = Date.parse("2026-10-04T18:29:59.000Z");
const withClose = (registrationOpens: string | null) => ({
  registrationCloses: "2026-10-04T18:29:59.000Z",
  registrationOpens,
});

describe("registrationState", () => {
  it("is 'upcoming' while no opening date has been announced", () => {
    expect(registrationState(closes - 30 * day, withClose(null))).toBe("upcoming");
  });

  it("is 'upcoming' before an announced opening date", () => {
    const fest = withClose(new Date(closes - 10 * day).toISOString());
    expect(registrationState(closes - 20 * day, fest)).toBe("upcoming");
  });

  it("is 'open' between the opening date and the close", () => {
    const fest = withClose(new Date(closes - 10 * day).toISOString());
    expect(registrationState(closes - 5 * day, fest)).toBe("open");
  });

  it("is 'closed' once the deadline has passed, whatever the opening date", () => {
    expect(registrationState(closes + 1, withClose(null))).toBe("closed");
    const fest = withClose(new Date(closes - 10 * day).toISOString());
    expect(registrationState(closes + 1, fest)).toBe("closed");
  });

  /* No announced deadline means registration does not close on its own — the
     committee ends it by setting a date, not by the calendar running out. */
  it("never closes on its own when no deadline is set", () => {
    const fest = { registrationCloses: null, registrationOpens: "2026-09-16T00:00:00.000Z" };
    expect(registrationState(closes + 365 * day, fest)).toBe("open");
    expect(registrationOpen(closes + 365 * day, fest)).toBe(true);
  });

  it("registrationOpen() is true only in the 'open' window", () => {
    const fest = withClose(new Date(closes - 10 * day).toISOString());
    expect(registrationOpen(closes - 5 * day, fest)).toBe(true);
    expect(registrationOpen(closes - 20 * day, fest)).toBe(false);
    expect(registrationOpen(closes + 1, fest)).toBe(false);
  });

  /* Registration is live, so the site must not be telling anyone otherwise. */
  it("is currently open", () => {
    expect(registrationState()).toBe("open");
    expect(FEST.registrationOpens).toBeTruthy();
  });

  it("explains why applications are refused, per state", () => {
    expect(registrationUnavailableMessage("upcoming")).toMatch(/hasn.t opened/i);
    // With no announced deadline there is no date to name.
    expect(registrationUnavailableMessage("closed")).toMatch(/closed/i);
  });
});
