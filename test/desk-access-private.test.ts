import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";
import { DESK_ACCESS, deskEmailsFor } from "@/lib/dashboard-access";

/**
 * Desk addresses must not be reachable from a browser.
 *
 * They were. Living on the event objects, which every page imports, put all
 * fifty-one of them into the serialised props of every public event page —
 * readable in view-source by anyone. Most are students' own accounts, and
 * two are personal Gmail addresses a coordinator handed over purely so they
 * could sign in.
 *
 * The fix is structural: the addresses live in a server-only module keyed by
 * slug, so importing them from a client component fails the build. These
 * guard the shape of that fix, since a future edit could quietly reattach
 * them to the event and nothing else would complain.
 */
describe("desk access stays server-side", () => {
  it("is not a field on any event", () => {
    for (const e of events)
      expect(Object.keys(e)).not.toContain("dashboardEmails");
  });

  it("still knows who runs each event", () => {
    const covered = events.filter((e) => deskEmailsFor(eventId(e.name)).length > 0);
    expect(covered.length).toBe(events.length);
  });

  it("is keyed by a real event slug, so nothing is stranded", () => {
    const slugs = new Set(events.map((e) => eventId(e.name)));
    for (const key of Object.keys(DESK_ACCESS)) expect(slugs).toContain(key);
  });

  it("holds usable addresses", () => {
    for (const key of Object.keys(DESK_ACCESS))
      for (const a of deskEmailsFor(key)) expect(a).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
  });

  /* The module is the boundary; server-only makes a client import a build
     error rather than a silent re-publication. */
  it("declares itself server-only", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("lib/dashboard-access.ts", "utf8")).toMatch(/^import "server-only";/);
  });
});
