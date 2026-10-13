import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { events, sponsors } from "@/lib/pravrutti-data";

/**
 * A logo path with no file behind it.
 *
 * Every sponsor in this list pointed at an image that was never shipped —
 * which is why the section drew generic icons and why nobody noticed the
 * paths had rotted. The component falls back rather than showing a torn box,
 * but a silent fallback hides the real problem: a sponsor who sent us their
 * mark and does not see it on the page.
 *
 * So the paths are checked against the filesystem. A logo either resolves or
 * is left empty on purpose; what it may not be is a promise of an image that
 * does not exist.
 */
describe("sponsor logos", () => {
  for (const s of sponsors) {
    it(`${s.name}: logo path resolves, or is deliberately empty`, () => {
      if (!s.logo) return; // no mark supplied yet — the icon stands in
      expect(existsSync(`public${s.logo}`), `missing file: public${s.logo}`).toBe(true);
    });
  }

  it("gives every sponsor a working website", () => {
    for (const s of sponsors) expect(s.website).toMatch(/^https:\/\/\S+$/);
  });

  it("event partner-perk logos resolve, and Seeed's Hacktivate award is listed", () => {
    for (const e of events) {
      for (const p of e.sponsorPerks ?? []) {
        expect(existsSync(`public${p.logo}`), `${e.name}: missing ${p.logo}`).toBe(true);
        expect(p.website).toMatch(/^https:\/\/\S+$/);
      }
    }
    const hk = events.find((e) => e.name === "Hacktivate");
    const seeed = hk?.sponsorPerks?.find((p) => p.sponsor === "Seeed Studio");
    expect(seeed?.website).toBe("https://www.seeedstudio.com");
    expect(seeed?.perks).toContain(
      "Best Voice AI Build, prize by reSpeaker (Seeed Studio)",
    );
    const pcb = hk?.sponsorPerks?.find((p) => p.sponsor === "PCB Cupid");
    expect(pcb?.website).toBe("https://pcbcupid.com/");
    expect(pcb?.perks?.length).toBeGreaterThan(0);
  });
});

