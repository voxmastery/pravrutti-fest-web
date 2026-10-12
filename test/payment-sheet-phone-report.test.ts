import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planFromSheet, type SheetPayment } from "@/lib/payment-sheet";
import type { Application } from "@/lib/applications";

/* The college sheet of 10 Oct 2026 (811 payments, through 9 Oct 11:13 PM IST).
   The 11 Oct upload was not stored, so this is the report the desk can still
   read. Payments whose email is not on a live registration, plus Mohammed
   Zainuddin Zidan's college-email payment, which is what makes the gmail
   payment a duplicate rather than a second approval. */

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/payment-report-2026-10-10.json", import.meta.url), "utf8"),
) as { payments: SheetPayment[]; applications: Application[] };

const plan = planFromSheet(fixture.payments, fixture.applications);

describe("10 Oct payment sheet, phone pass", () => {
  it("holds Likith on CODE RED because ZERO HOUR is full", () => {
    expect(plan.approve.find((a) => a.note?.includes("llikith179@gmail.com"))).toBeUndefined();
    const row = plan.held.find((a) => a.email === "jockergk44@gmail.com");
    expect(row).toMatchObject({
      email: "jockergk44@gmail.com",
      eventId: "zero-hour",
      teamCode: "62JN3RM2GRBB",
      via: "phone",
      flag: "event full / over cap",
      /* The row already carries a reference the student typed (letter O where
         the report has a zero). The sheet must not overwrite it. */
      transaction: null,
      note: "matched by phone (sheet email llikith179@gmail.com, site email jockergk44@gmail.com)",
    });
  });

  it("puts the phone-confirmed majority in already confirmed, not unmatched", () => {
    /* 37 sheet emails with no live registration, minus Likith (approved),
       Zidan (duplicate), Talha (two site emails), Mokshith (cancelled),
       Raksha (9-digit phone) and the three different-name phones. */
    expect(plan.confirmedElsewhere.length).toBe(29);
    expect(plan.confirmedElsewhere.every((u) => u.siteEmail.toLowerCase() !== u.email)).toBe(true);
    expect(plan.confirmedElsewhere.find((u) => u.email === "23etas012033@msruas.ac.in")?.events[0]).toMatchObject({
      eventName: "LINE FOLLOWER",
      teamCode: "NLF2HRY278GW",
    });
  });

  it("sends the three different-name phones to manual check", () => {
    const reasons = new Map(plan.needsCheck.map((n) => [n.email, n.reason]));
    expect(reasons.get("raghavns361@gmail.com")).toBe("phone belongs to a different name");
    expect(reasons.get("kavyashree.haridas@gmail.com")).toBe("phone belongs to a different name");
    expect(reasons.get("blackbirdbb360@gmail.com")).toBe("phone belongs to a different name");
    for (const email of ["raghavns361@gmail.com", "kavyashree.haridas@gmail.com", "blackbirdbb360@gmail.com"]) {
      expect(plan.approve.find((a) => a.note?.includes(email))).toBeUndefined();
      expect(plan.confirmedElsewhere.find((u) => u.email === email)).toBeUndefined();
    }
  });

  it("flags Zidan's gmail payment as a duplicate of the college-email approval", () => {
    const dup = plan.needsCheck.find((n) => n.email === "zainuzidan27@gmail.com");
    expect(dup?.reason).toBe("possible duplicate payment");
    expect(plan.approve.find((a) => a.email === "zainuzidan27@gmail.com")).toBeUndefined();
    /* AI ESCAPE ROOM is marked full, so the college-email match is listed and left out. */
    expect(plan.held.find((a) => a.email === "4mt25ci027@mite.ac.in")?.flag).toBe("event full / over cap");
  });
});
