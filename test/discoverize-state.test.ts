import { describe, it, expect } from "vitest";
import { discoverizeState, mayPay, maySubmitAbstract, isDiscoverize, DISCOVERIZE_EVENT_ID } from "@/lib/discoverize";

/* Discoverize charges at the END of its funnel: free to enter, ₹200 only if
   the judges shortlist you. Every screen and every endpoint reads the team's
   position from here, so this is where the rules have to be right. */

const app = (over: Record<string, unknown> = {}) =>
  ({ status: "pending", payment: "not_required", ...over }) as any;

describe("discoverizeState", () => {
  it("starts at registered — nothing submitted, nothing owed", () => {
    expect(discoverizeState(app())).toBe("registered");
  });

  it("moves to abstract submitted once the form submission is recorded", () => {
    expect(discoverizeState(app({ round: { abstractSubmittedAt: "2026-09-20T10:00:00Z" } }))).toBe("abstract_submitted");
  });

  it("moves to payment pending when shortlisting puts the fee on the team", () => {
    const a = app({ round: { abstractSubmittedAt: "x", shortlistedAt: "y" }, payment: "awaiting" });
    expect(discoverizeState(a)).toBe("payment_pending");
  });

  /* A shortlist recorded before the fee is attached is still a shortlist. */
  it("reads as shortlisted when the fee has not been attached yet", () => {
    expect(discoverizeState(app({ round: { shortlistedAt: "y" } }))).toBe("shortlisted");
  });

  it("reads as payment successful once the money is recorded", () => {
    expect(discoverizeState(app({ round: { shortlistedAt: "y" }, payment: "paid" }))).toBe("payment_successful");
  });

  it("reads as final round confirmed once an organiser confirms the place", () => {
    expect(discoverizeState(app({ round: { shortlistedAt: "y" }, payment: "paid", status: "confirmed" }))).toBe("final_round_confirmed");
  });

  it("is closed for a withdrawn or declined registration", () => {
    expect(discoverizeState(app({ status: "cancelled" }))).toBe("closed");
    expect(discoverizeState(app({ status: "declined", round: { shortlistedAt: "y" } }))).toBe("closed");
  });
});

describe("what a team is allowed to do", () => {
  /* Discoverize is free at every stage, so the payment endpoints refuse
     everybody — including a team the judges have put through. */
  it("lets nobody pay, shortlisted or not", () => {
    expect(mayPay(app())).toBe(false);
    expect(mayPay(app({ round: { abstractSubmittedAt: "x" } }))).toBe(false);
    expect(mayPay(app({ round: { shortlistedAt: "y" } }))).toBe(false);
    expect(mayPay(app({ round: { shortlistedAt: "y" }, payment: "awaiting" }))).toBe(false);
  });

  it("asks for the abstract once, and stops asking after it arrives", () => {
    expect(maySubmitAbstract(app())).toBe(true);
    expect(maySubmitAbstract(app({ round: { abstractSubmittedAt: "x" } }))).toBe(false);
    expect(maySubmitAbstract(app({ status: "cancelled" }))).toBe(false);
  });
});

describe("isDiscoverize", () => {
  it("matches only this event, so no other event changes behaviour", () => {
    expect(isDiscoverize(DISCOVERIZE_EVENT_ID)).toBe(true);
    expect(isDiscoverize("chaos")).toBe(false);
    expect(isDiscoverize(null)).toBe(false);
    expect(isDiscoverize(undefined)).toBe(false);
  });
});
