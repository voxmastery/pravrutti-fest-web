import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { footerRegistrationLine } from "@/components/landing/footer-section";

/**
 * The footer says where registration actually stands.
 *
 * It read "Registrations open soon" on every page from before launch until
 * 6 Oct 2026 — three weeks into registration, a day before the deadline.
 */

const fest = (opens: string | null, closes: string | null) => ({ registrationOpens: opens, registrationCloses: closes });
const OPENS = "2026-09-16T00:00:00.000Z", CLOSES = "2026-10-09T18:29:59.000Z";

describe("footerRegistrationLine", () => {
  it("says when registration closes while it is open", () => {
    expect(footerRegistrationLine(Date.parse("2026-10-06T06:00:00Z"), fest(OPENS, CLOSES))).toBe("Registrations open till 9th October");
  });

  it("says closed once the deadline has passed", () => {
    expect(footerRegistrationLine(Date.parse("2026-10-10T06:00:00Z"), fest(OPENS, CLOSES))).toBe("Registrations closed");
  });

  it("says open soon only before it opens", () => {
    expect(footerRegistrationLine(Date.parse("2026-09-10T06:00:00Z"), fest(OPENS, CLOSES))).toBe("Registrations open soon");
  });

  it("says open with no deadline announced", () => {
    expect(footerRegistrationLine(Date.parse("2026-10-06T06:00:00Z"), fest(OPENS, null))).toBe("Registrations open");
  });

  it("is what the footer renders, not a fixed string", () => {
    const src = readFileSync(fileURLToPath(new URL("../components/landing/footer-section.tsx", import.meta.url)), "utf8");
    expect(src).not.toMatch(/>\s*Registrations open soon\s*</);
  });
});
