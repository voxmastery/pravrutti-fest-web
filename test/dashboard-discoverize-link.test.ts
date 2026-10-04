import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Discoverize's coordinators can find their screening desk.
 *
 * Discoverize screens abstracts before anyone presents, and its coordinators
 * do the screening on /dashboard/discoverize. The only link to it was on the
 * organisers' dashboard, so coordinators screened from their "My event"
 * roster instead — until that roster went confirmed-only on 3 Oct, and on
 * Discoverize confirmed means through to the final round. Fifty-three teams
 * under review vanished from Aaliyah's screen, two remained, and she had no
 * way to the page that still had them all.
 *
 * There is no component test environment, so this reads the source: the
 * coordinator's view links the screening desk when Discoverize is open.
 */

const src = readFileSync(fileURLToPath(new URL("../app/dashboard/page.tsx", import.meta.url)), "utf8");
const start = src.indexOf('if (dash.role === "coordinator") {');
const end = src.indexOf("// ── Organiser", start);
const coordinatorView = src.slice(start, end);

describe("the coordinator's dashboard", () => {
  it("is where this test thinks it is", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("links Discoverize's screening desk when Discoverize is open", () => {
    expect(coordinatorView).toContain('href="/dashboard/discoverize"');
    expect(coordinatorView).toMatch(/open === DISCOVERIZE_EVENT_ID/);
  });
});
