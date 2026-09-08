import { describe, it, expect } from "vitest";
import {
  FEST,
  registrationState,
  registrationOpen,
  registrationUnavailableMessage,
} from "@/lib/pravrutti-data";

const closes = Date.parse(FEST.registrationCloses);
const day = 24 * 60 * 60 * 1000;

describe("registrationState", () => {
  it("is 'upcoming' while no opening date has been announced", () => {
    expect(registrationState(closes - 30 * day, { ...FEST, registrationOpens: null })).toBe("upcoming");
  });

  it("is 'upcoming' before an announced opening date", () => {
    const fest = { ...FEST, registrationOpens: new Date(closes - 10 * day).toISOString() };
    expect(registrationState(closes - 20 * day, fest)).toBe("upcoming");
  });

  it("is 'open' between the opening date and the close", () => {
    const fest = { ...FEST, registrationOpens: new Date(closes - 10 * day).toISOString() };
    expect(registrationState(closes - 5 * day, fest)).toBe("open");
  });

  it("is 'closed' once the deadline has passed, whatever the opening date", () => {
    expect(registrationState(closes + 1, { ...FEST, registrationOpens: null })).toBe("closed");
    const fest = { ...FEST, registrationOpens: new Date(closes - 10 * day).toISOString() };
    expect(registrationState(closes + 1, fest)).toBe("closed");
  });

  it("registrationOpen() is true only in the 'open' window", () => {
    const fest = { ...FEST, registrationOpens: new Date(closes - 10 * day).toISOString() };
    expect(registrationOpen(closes - 5 * day, fest)).toBe(true);
    expect(registrationOpen(closes - 20 * day, fest)).toBe(false);
    expect(registrationOpen(closes + 1, fest)).toBe(false);
  });

  it("explains why applications are refused, per state", () => {
    expect(registrationUnavailableMessage("upcoming")).toMatch(/hasn.t opened/i);
    expect(registrationUnavailableMessage("closed")).toMatch(/closed on 04 OCT 2026/i);
  });
});
