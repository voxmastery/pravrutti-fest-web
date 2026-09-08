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
  it("names the IST calendar date of the closing instant", () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(new Date(FEST.registrationCloses));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

    expect(REGISTRATION_CLOSES_DISPLAY).toBe(
      `${part("day")} ${part("month").toUpperCase()} ${part("year")}`
    );
  });

  it("does not fall on the UTC day, which is what a bare formatter would print", () => {
    // 18:29:59Z is 23:59:59 IST the same evening here, but the whole point of the
    // helper is that it reads IST parts; if the deadline ever moves past midnight
    // UTC the two diverge and this keeps the HUD on the participants' date.
    const ist = new Date(Date.parse(FEST.registrationCloses) + (5 * 60 + 30) * 60 * 1000);
    expect(REGISTRATION_CLOSES_DISPLAY.startsWith(String(ist.getUTCDate()).padStart(2, "0"))).toBe(true);
  });

  it("describes a deadline that falls before the fest opens", () => {
    const start = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(FEST.startUtc)!;
    const startMs = Date.UTC(
      Number(start[1]),
      Number(start[2]) - 1,
      Number(start[3]),
      Number(start[4]),
      Number(start[5])
    );
    expect(Date.parse(FEST.registrationCloses)).toBeLessThan(startMs);
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
