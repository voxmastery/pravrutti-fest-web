import { describe, it, expect } from "vitest";
import { appStatusTone, payStatusTone } from "@/lib/status-tone";

describe("status tones", () => {
  it("maps every application status to a tone and label", () => {
    expect(appStatusTone("pending")).toEqual({ tone: "warning", label: "In review" });
    expect(appStatusTone("confirmed")).toEqual({ tone: "success", label: "Confirmed" });
    expect(appStatusTone("declined")).toEqual({ tone: "neutral", label: "Declined" });
  });

  it("maps every payment status", () => {
    expect(payStatusTone("paid")).toEqual({ tone: "success", label: "Paid" });
    expect(payStatusTone("awaiting")).toEqual({ tone: "warning", label: "Payment due" });
    expect(payStatusTone("not_required")).toEqual({ tone: "neutral", label: "No payment" });
    expect(payStatusTone("refunded")).toEqual({ tone: "neutral", label: "Refunded" });
  });

  it("never renders an empty badge for a missing or unknown value", () => {
    // Seeded rows and older records can lack the field entirely.
    expect(payStatusTone(undefined)).toEqual({ tone: "neutral", label: "Unknown" });
    expect(payStatusTone("something_else")).toEqual({ tone: "neutral", label: "Unknown" });
    expect(appStatusTone(null)).toEqual({ tone: "neutral", label: "Unknown" });
  });
});
