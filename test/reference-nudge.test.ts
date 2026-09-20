import { describe, it, expect } from "vitest";
import { afterYesPressed } from "@/lib/reference-nudge";
import { isValidPaymentRef } from "@/lib/applications";

describe("tapping 'Yes, I've paid'", () => {
  it("asks once for the reference when the field is empty", () => {
    expect(afterYesPressed("", false, isValidPaymentRef)).toEqual({ kind: "nudge" });
    expect(afterYesPressed("   ", false, isValidPaymentRef)).toEqual({ kind: "nudge" });
  });

  it("goes through without one on the second tap — nobody is blocked", () => {
    expect(afterYesPressed("", true, isValidPaymentRef)).toEqual({ kind: "submit", withReference: false });
  });

  it("goes through with a reference the moment one is typed, nudged or not", () => {
    expect(afterYesPressed("JIDCWIOOPNUQEVB", false, isValidPaymentRef)).toEqual({ kind: "submit", withReference: true });
    expect(afterYesPressed(" JIDCWIOOPNU1QEV ", true, isValidPaymentRef)).toEqual({ kind: "submit", withReference: true });
  });

  it("tells them when what they typed cannot be a reference", () => {
    expect(afterYesPressed("abc", false, isValidPaymentRef)).toEqual({ kind: "invalid" });
    expect(afterYesPressed("abc", true, isValidPaymentRef)).toEqual({ kind: "invalid" });
  });
});
