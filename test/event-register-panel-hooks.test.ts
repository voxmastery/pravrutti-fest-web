import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Every hook in the event panel runs before it can return early.
 *
 * React needs the same hooks, in the same order, on every render. The panel
 * returned early for a confirmed viewer — and two hooks sat below that
 * return. Nobody became confirmed while the page was open, so it never
 * mattered, until joining an approved team started confirming people on the
 * spot: then the same render that confirmed them dropped two hooks and the
 * page fell over with "This page couldn't load". Fifteen students saw that
 * the moment they pressed Join, though every one of them was registered.
 *
 * The repository has no component test environment and no hooks lint, so
 * this reads the source: inside the component's body, no hook call may come
 * after the first top-level early return.
 */

const src = readFileSync(
  fileURLToPath(new URL("../components/event-register-panel.tsx", import.meta.url)),
  "utf8",
);

function componentBody(name: string): string[] {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^export (default )?function ${name}\\b`).test(l));
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = lines.findIndex((l, i) => i > start && l === "}");
  return lines.slice(start, end);
}

describe("EventRegisterPanel and the rules of hooks", () => {
  const body = componentBody("EventRegisterPanel");
  /* Top-level statements of the component sit at two spaces; anything deeper
     is inside a callback or JSX, where a "useX(" is not a hook call. */
  const isHook = (l: string) => /^ {2}(?:const|let|var)?[^(]*?\buse[A-Z]\w*\(/.test(l) || /^ {2}use[A-Z]\w*\(/.test(l);
  const isEarlyReturn = (l: string) => /^ {2}if \(.+\) return\b/.test(l);

  it("has hooks and an early return to check", () => {
    expect(body.some(isHook)).toBe(true);
    expect(body.some(isEarlyReturn)).toBe(true);
  });

  it("calls every hook before its first early return", () => {
    const firstReturn = body.findIndex(isEarlyReturn);
    const late = body
      .map((l, i) => ({ l: l.trim(), i }))
      .filter(({ l, i }) => i > firstReturn && isHook(body[i]));
    expect(late.map((x) => x.l)).toEqual([]);
  });
});

/* "11 applications in review" on Pitch at Mach was eleven people in four
   teams, and read as eleven teams beside "7 of 25 teams confirmed". */
describe("the in-review line", () => {
  it("counts teams on an event counted in teams", () => {
    expect(src).toMatch(/d\.pendingTeams\?\.\[id\]/);
    expect(src).toMatch(/countTeams\s*\?\s*`\$\{waitingTeams\} \$\{waitingTeams === 1 \? "team" : "teams"\} in review`/);
  });
});

/* An organiser note belongs under the join button, and nowhere else on the
   card — it is for someone about to request a place. */
describe("the register note", () => {
  it("renders under Request to join", () => {
    const join = src.indexOf("Request to join");
    const note = src.indexOf("event.registerNote");
    expect(join).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(join);
  });
});
