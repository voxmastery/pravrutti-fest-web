import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* Vercel Blob is gone. If an import creeps back the app silently depends on a
   vendor we no longer pay for, and writes land somewhere nobody reads. */
function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("Vercel Blob is fully removed", () => {
  it("has no @vercel/blob import in app/ or lib/", () => {
    const offenders = [...walk("app"), ...walk("lib")].filter((f) =>
      readFileSync(f, "utf8").includes("@vercel/blob")
    );
    expect(offenders).toEqual([]);
  });

  /* The package itself stays installed until the migration script has copied
     every blob across — that script is the one remaining legitimate reader.
     The assertion that it is gone from package.json lands with that commit. */
});
