import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";

/* The rulebook button is public. DENT - INNOVATE once pointed at the club's
   "Event Proposal, Requirement Form & Guidelines" — an internal form carrying
   three personal mobile numbers, four personal email addresses and the event
   budget, downloadable by anyone who clicked it. These are the cheap checks
   that would have caught it. */

describe("rulebook links", () => {
  it("never points at the withdrawn proposal form", () => {
    const leaked = "1CEDr_uGifU8BXsAPK3ZwU968vxwZtHA-";
    const offenders = events.filter((e) => e.brochureUrl.includes(leaked)).map((e) => e.name);
    expect(offenders).toEqual([]);
  });

  it("is either empty or a usable link, never something in between", () => {
    for (const e of events) {
      if (e.brochureUrl === "") continue;
      expect(
        e.brochureUrl.startsWith("/") || e.brochureUrl.startsWith("https://"),
        `${e.name}: ${e.brochureUrl}`
      ).toBe(true);
    }
  });

  /* Names the events currently without one, so a rulebook arriving — or
     quietly vanishing — is a deliberate edit rather than a surprise. */
  it("lists the events still waiting on a rulebook", () => {
    const missing = events.filter((e) => !e.brochureUrl).map((e) => eventId(e.name));
    expect(missing).toEqual(["dent-innovate", "pitch-pulse"]);
  });

  it("gives every self-hosted rulebook a .pdf path", () => {
    for (const e of events) {
      if (!e.brochureUrl.startsWith("/")) continue;
      expect(e.brochureUrl.endsWith(".pdf"), `${e.name}: ${e.brochureUrl}`).toBe(true);
    }
  });
});
