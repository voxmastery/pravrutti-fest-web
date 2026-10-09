import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { events } from "@/lib/pravrutti-data";
import { PRIZE_GST_NOTE } from "@/components/prize-gst-note";

/* Prize figures are printed in four places. The caption has to be the same
   line in each, and it must not be a one-off on a single hackathon. */
const SURFACES = [
  "components/landing/hero-section.tsx",
  "components/event-page-view.tsx",
  "app/events/page.tsx",
  "app/about/page.tsx",
];

describe("prize GST note", () => {
  it("uses the agreed wording", () => {
    expect(PRIZE_GST_NOTE).toBe("*Prize pool inclusive of GST");
  });

  it("sits on every surface that prints a prize figure", () => {
    for (const file of SURFACES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("PrizeGstNote");
      expect(src, file).not.toContain("Become a sponsor");
    }
  });

  it("covers every event, because the event page is the shared prize block", () => {
    expect(events.filter((e) => e.prizes.length > 0)).toHaveLength(events.length);
    expect(events).toHaveLength(25);
  });
});