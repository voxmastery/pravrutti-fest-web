import { describe, it, expect } from "vitest";
import { countsAsRegistered } from "@/lib/applications";

/* What holds a place. Counting an unpaid or withdrawn attempt inflates every
   fill figure and can show an event full while real places sit empty — so this
   is the one rule the public counter and the organiser dashboard both use. */

const app = (over: Record<string, unknown> = {}) => ({
  status: "confirmed",
  payment: "paid",
  paymentRef: "JUNO-2026-0091",
  ...over,
});

describe("countsAsRegistered", () => {
  it("counts a verified, paid registration", () => {
    expect(countsAsRegistered(app())).toBe(true);
  });

  it("counts one still in review, because the fee is already paid", () => {
    expect(countsAsRegistered(app({ status: "pending" }))).toBe(true);
  });

  /* A joiner owes nothing — their lead paid for the team — and a free entry
     never owed anything. Both hold real places. */
  it("counts an entry that owes nothing", () => {
    expect(countsAsRegistered(app({ payment: "not_required", paymentRef: null }))).toBe(true);
    expect(countsAsRegistered(app({ status: "pending", payment: "not_required", paymentRef: null }))).toBe(true);
  });

  /* Paid on the portal, waiting on us to verify: the place is genuinely taken,
     so holding it is right — otherwise the event oversells while we catch up. */
  it("counts an unverified fee when a receipt reference was quoted", () => {
    expect(countsAsRegistered(app({ status: "pending", payment: "awaiting" }))).toBe(true);
  });

  /* Started and never paid — the incomplete registration this rule exists for. */
  it("does not count an unverified fee with no reference", () => {
    expect(countsAsRegistered(app({ status: "pending", payment: "awaiting", paymentRef: null }))).toBe(false);
    expect(countsAsRegistered(app({ status: "pending", payment: "awaiting", paymentRef: "   " }))).toBe(false);
  });

  it("does not count someone who withdrew", () => {
    expect(countsAsRegistered(app({ status: "cancelled" }))).toBe(false);
  });

  it("does not count someone the organisers turned down", () => {
    expect(countsAsRegistered(app({ status: "declined" }))).toBe(false);
  });

  /* The money went back, so the place did too. */
  it("does not count a refunded fee", () => {
    expect(countsAsRegistered(app({ payment: "refunded" }))).toBe(false);
    expect(countsAsRegistered(app({ status: "pending", payment: "refunded" }))).toBe(false);
  });

  it("does not count rows with a status or payment it does not recognise", () => {
    expect(countsAsRegistered(app({ status: "weird" }))).toBe(false);
    expect(countsAsRegistered(app({ payment: "weird" }))).toBe(false);
    expect(countsAsRegistered({})).toBe(false);
  });
});
