import { describe, it, expect } from "vitest";
import { isValidPaymentRef } from "@/lib/applications";

/* We cannot check a reference against Juno from here, so the bar is "could this
   be a receipt reference" — not "is it the right one". An organiser still
   matches it against the statement. What this must stop is junk being filed as
   proof that ₹200 was paid. */

describe("isValidPaymentRef", () => {
  it("accepts the shapes a real receipt takes", () => {
    for (const ok of ["JUNO-2026-0091", "TXN123456", "1234567890123", "ab12cd34", "PAY/2026/0091", "a1b2c3"])
      expect(isValidPaymentRef(ok), ok).toBe(true);
  });

  it("rejects anything too short to be a reference", () => {
    expect(isValidPaymentRef("12345")).toBe(false);
    expect(isValidPaymentRef("")).toBe(false);
  });

  /* "asdf", "qwerty" — letters mashed into the box. Every real transaction
     reference carries at least one digit. */
  it("rejects text with no digit in it", () => {
    for (const bad of ["asdfgh", "qwertyui", "PAIDONLINE"])
      expect(isValidPaymentRef(bad), bad).toBe(false);
  });

  it("rejects one character held down", () => {
    expect(isValidPaymentRef("000000")).toBe(false);
    expect(isValidPaymentRef("aaaaaaaa")).toBe(false);
  });

  it("rejects characters a reference never contains", () => {
    for (const bad of ["hello world 1", "<script>1", "12345!", "tx;drop 1"])
      expect(isValidPaymentRef(bad), bad).toBe(false);
  });

  it("trims before judging, so stray spaces do not decide it", () => {
    expect(isValidPaymentRef("  JUNO-2026-0091  ")).toBe(true);
  });

  /* readPaymentRef already bounds the stored value at 80 characters, so an
     over-long paste is truncated rather than rejected. */
  it("truncates rather than rejects an over-long paste", () => {
    expect(isValidPaymentRef("A1".repeat(60))).toBe(true);
  });
});
