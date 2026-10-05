import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every "My Tickets" goes to the page that has the tickets.
 *
 * There were two. /ticket reads the student's registrations and shows each
 * confirmed one's QR code. /tickets is the placeholder from before there was
 * a backend, and says "No registrations yet" to everyone, always. The menu
 * linked the first; the footer's "My Tickets" and the events page's "Track
 * your registrations" linked the second — so a confirmed student who
 * scrolled down was told they had nothing, with the fest's ticket emails
 * stuck behind the mail limit and that page their only way to their QR.
 *
 * So nothing links /tickets, and the address itself — already passed around
 * in WhatsApp groups — redirects to the real page.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) return sources(rel);
    return /\.(tsx?|jsx?)$/.test(name) ? [rel] : [];
  });
}

describe("the way to a student's ticket", () => {
  it("links nothing to the placeholder page", () => {
    const linking = [...sources("app"), ...sources("components")].filter((f) =>
      /href=\{?["'`]\/tickets["'`]|href:\s*["'`]\/tickets["'`]/.test(read(f)),
    );
    expect(linking).toEqual([]);
  });

  it("sends the footer's My Tickets to the real page", () => {
    expect(read("components/landing/footer-section.tsx")).toMatch(/name: "My Tickets", href: "\/ticket"/);
  });

  it("redirects the old address to the real page", () => {
    expect(read("app/tickets/page.tsx")).toMatch(/redirect\(["']\/ticket["']\)/);
  });
});
