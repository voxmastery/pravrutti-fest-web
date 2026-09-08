import { describe, it, expect } from "vitest";
import { PHONE_LENGTH, normalizePhone, isValidPhone, phoneFieldValue } from "@/lib/applications";

/* One phone rule shared by the form and the API. The form's maxLength is
   cosmetic — anyone can POST — so these assert the rule itself, including the
   paste shapes contact apps and password managers actually hand over. */

describe("normalizePhone", () => {
  it("keeps a bare 10-digit number as-is", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });

  it("drops the spaces in a number typed the way people read them out", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
  });

  it("recovers the number from a pasted +91 form instead of truncating it", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("+919876543210")).toBe("9876543210");
    expect(normalizePhone("91 9876543210")).toBe("9876543210");
    expect(normalizePhone("0091-98765-43210")).toBe("9876543210");
  });

  it("drops a leading trunk zero", () => {
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it("strips letters and punctuation rather than keeping them", () => {
    expect(normalizePhone("98765abc43210")).toBe("9876543210");
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210");
  });

  it("leaves an over-long run of digits over-long, so it fails validation", () => {
    expect(normalizePhone("98765432101")).toBe("98765432101");
  });

  it("survives the values a hand-rolled POST can carry", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone({})).toBe("");
    expect(normalizePhone(9876543210)).toBe("9876543210");
  });
});

describe("isValidPhone", () => {
  it("accepts every Indian mobile prefix", () => {
    for (const first of ["6", "7", "8", "9"]) expect(isValidPhone(`${first}123456789`)).toBe(true);
  });

  it("accepts the numbers already on file for coordinators", () => {
    for (const p of ["9611367397", "63602 69253", "+91 8147192405"]) expect(isValidPhone(p)).toBe(true);
  });

  it("rejects a landline or invalid first digit", () => {
    for (const p of ["1234567890", "5876543210", "0123456789"]) expect(isValidPhone(p)).toBe(false);
  });

  it("rejects anything that is not exactly 10 digits", () => {
    for (const p of ["", "9", "987654321", "98765432101", "9876543210987"])
      expect(isValidPhone(p)).toBe(false);
  });

  it("rejects text dressed up as a number", () => {
    for (const p of ["not a phone", "9876-54-32-1x", "+91"]) expect(isValidPhone(p)).toBe(false);
  });
});

describe("phoneFieldValue", () => {
  it("caps what the field can hold at one number's worth of digits", () => {
    expect(phoneFieldValue("98765432109999")).toHaveLength(PHONE_LENGTH);
  });

  it("lets a pasted +91 number land complete and valid", () => {
    const value = phoneFieldValue("+91 98765 43210");
    expect(value).toBe("9876543210");
    expect(isValidPhone(value)).toBe(true);
  });

  it("never puts a non-digit in the field", () => {
    expect(phoneFieldValue("+9-8 7a6")).toBe("9876");
  });
});
