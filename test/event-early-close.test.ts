import { describe, it, expect } from "vitest";
import { events, festFor, eventClosesDisplay, eventClosedMessage, registrationState, FEST } from "@/lib/pravrutti-data";

const hk = events.find((e) => e.name === "Hacktivate")!;
const chaos = events.find((e) => e.name === "CHAOS")!;

describe("an event closing before the fest-wide date", () => {
  it("Hacktivate closes at 11:59 PM IST on 1 October", () => {
    expect(eventClosesDisplay(hk)).toBe("11:59 PM, 01 OCT 2026");
    expect(registrationState(Date.parse("2026-10-01T18:29:00Z"), festFor(hk))).toBe("open");
    expect(registrationState(Date.parse("2026-10-01T18:30:00Z"), festFor(hk))).toBe("closed");
  });

  it("leaves every other event on the fest-wide date", () => {
    expect(festFor(chaos)).toBe(FEST);
    expect(eventClosesDisplay(chaos)).toBe("");
    expect(registrationState(Date.parse("2026-10-01T18:30:00Z"), festFor(chaos))).toBe("open");
  });

  it("says when it closed", () => {
    expect(eventClosedMessage(hk)).toBe("Registration for Hacktivate closed at 11:59 PM, 01 OCT 2026 IST.");
  });
});
