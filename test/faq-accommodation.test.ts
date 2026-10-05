import { describe, it, expect } from "vitest";
import { faqs } from "@/lib/pravrutti-data";
import { accommodation } from "@/lib/schedule";

/**
 * The FAQ and the schedule give the same answer about beds.
 *
 * The schedule page said accommodation is provided at ₹450 a head a day and
 * named who to ring; the FAQ, written before that was arranged, still said
 * "Accommodation will not be provided". An outstation student reads the FAQ
 * first and decides whether they can come at all.
 */

const answer = () =>
  faqs.find((f) => /accommodation/i.test(f.question))?.answer ?? "";

describe("the FAQ on accommodation", () => {
  it("exists", () => {
    expect(answer()).not.toBe("");
  });

  it("says it is provided, as the schedule does", () => {
    expect(accommodation.offered).toBe(true);
    expect(answer()).not.toMatch(/not be provided/i);
    expect(answer()).toMatch(/^Yes/);
  });

  it("gives the schedule's rate", () => {
    expect(answer()).toContain(`${accommodation.currency}${accommodation.ratePerHeadPerDay.toLocaleString("en-IN")}`);
  });

  it("says who to call to book, with their numbers", () => {
    for (const c of accommodation.contacts) {
      expect(answer()).toContain(c.name);
      expect(answer()).toContain(c.phone);
    }
  });
});
