import { describe, it, expect } from "vitest";
import { FEST, FEST_START } from "@/lib/pravrutti-data";

/* The calendar badge on the event panel used to carry a hand-typed "15" while
   the fest actually opens on the 14th. These assert the badge is derived, so
   moving the fest can't leave the two disagreeing again. */
describe("FEST_START", () => {
  it("agrees with the day FEST.dates opens on", () => {
    const first = /(\d{1,2})/.exec(FEST.dates)?.[1];
    expect(FEST_START.day).toBe(String(Number(first)));
  });

  it("agrees with the month named in FEST.dates", () => {
    expect(FEST.dates.toUpperCase()).toContain(FEST_START.month);
  });

  it("is a usable badge, not blank", () => {
    expect(FEST_START.day).not.toBe("");
    expect(FEST_START.month).toHaveLength(3);
  });
});
