import { describe, it, expect } from "vitest";
import {
  CAMPUS_COORDS,
  contacts,
  FEST,
  REGISTRATION_CLOSES_DISPLAY,
} from "@/lib/pravrutti-data";

/* The hero HUD used to hand-type its closing date and its coordinates, and the
   coordinates were ~5km off. These assert the displayed values still agree with
   the data they come from, so moving the deadline or the map pin can't leave the
   hero quoting the old one. */

describe("REGISTRATION_CLOSES_DISPLAY", () => {
  /* The deadline is 5 October, 11:59 PM IST — 18:29:59Z. Read in UTC that is
     still the 5th, but the helper must shift to IST first so a later edit to a
     time after 18:30Z cannot show the wrong day. */
  it("shows the announced deadline as an IST date", () => {
    expect(FEST.registrationCloses).toBe("2026-10-05T18:29:59.000Z");
    expect(REGISTRATION_CLOSES_DISPLAY).toBe("05 OCT 2026");
  });

  it("never renders a broken date", () => {
    expect(REGISTRATION_CLOSES_DISPLAY).not.toMatch(/invalid|nan|undefined/i);
  });
});

describe("CAMPUS_COORDS", () => {
  it("is read off the map embed that already points at the venue", () => {
    expect(CAMPUS_COORDS).not.toBeNull();
    const url = contacts.location.embedUrl;
    expect(url).toContain(`!3d${CAMPUS_COORDS!.lat}`);
    expect(url).toContain(`!2d${CAMPUS_COORDS!.lng}`);
  });

  it("labels the same position it holds", () => {
    expect(CAMPUS_COORDS!.label).toContain(Math.abs(CAMPUS_COORDS!.lat).toFixed(4));
    expect(CAMPUS_COORDS!.label).toContain(Math.abs(CAMPUS_COORDS!.lng).toFixed(4));
    expect(CAMPUS_COORDS!.label).toContain(CAMPUS_COORDS!.lat >= 0 ? "N" : "S");
    expect(CAMPUS_COORDS!.label).toContain(CAMPUS_COORDS!.lng >= 0 ? "E" : "W");
  });
});
