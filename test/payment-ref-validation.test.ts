import { describe, it, expect } from "vitest";
import { isValidPaymentRef } from "@/lib/applications";

/* We cannot check a reference against Juno from here, so the bar is "could this
   be a receipt reference" — not "is it the right one". An organiser still
   matches it against the statement. What this must stop is junk being filed as
   proof that ₹200 was paid. */

describe("isValidPaymentRef", () => {
  it("accepts the shapes a real receipt takes", () => {
    for (const ok of ["JUNO-2026-0091", "TXN123456", "1234567890123", "ab12cd34", "PAY/2026/0091", "a1b2c3d4"])
      expect(isValidPaymentRef(ok), ok).toBe(true);
  });

  it("rejects anything too short to be a reference", () => {
    expect(isValidPaymentRef("12345")).toBe(false);
    expect(isValidPaymentRef("")).toBe(false);
  });

  /* JUNO's Transaction Reference No is fifteen letters and digits in any mix,
     so a genuine one can carry no digit at all. A digit rule here silently
     threw those away — the check is now length and shape only. */
  it("accepts JUNO's reference shapes, with or without a digit", () => {
    for (const ok of ["JIDCWIOOPNUQEVB", "JIDCWIOOPNU1QEV", "GQDT-8CQWJK77MBF"])
      expect(isValidPaymentRef(ok), ok).toBe(true);
  });

  it("still rejects something too short to be a reference", () => {
    for (const bad of ["asdfgh", "PAID", "1234567"])
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
