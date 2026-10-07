import { describe, it, expect } from "vitest";
import { discoverizeState, mayPay, maySubmitAbstract, isDiscoverize, DISCOVERIZE_EVENT_ID } from "@/lib/discoverize";

/* Discoverize charges at the END of its funnel: free to enter, ₹200 only if
   the coordinators shortlist you. Every screen and every endpoint reads the
   team's position from here, so this is where the rules have to be right. */

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

  /* Back in review once they have answered the pay step — with or without a
     JUNO reference — exactly like every other event's paid entry. */
  it("moves to payment submitted once the pay step is answered", () => {
    expect(discoverizeState(app({ round: { shortlistedAt: "y", paymentSubmittedAt: "z" }, payment: "awaiting" }))).toBe("payment_submitted");
    expect(discoverizeState(app({ round: { shortlistedAt: "y" }, payment: "awaiting", paymentRef: "JIDCWIOOPNU1QEV" }))).toBe("payment_submitted");
  });

  /* A shortlist recorded before the fee is attached is still a shortlist —
     and a teammate, who never owes, reads as shortlisted. */
  it("reads as shortlisted when no fee sits on the row", () => {
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
  it("lets only a shortlisted team that owes the fee pay", () => {
    expect(mayPay(app())).toBe(false);
    expect(mayPay(app({ round: { abstractSubmittedAt: "x" } }))).toBe(false);
    /* Shortlisted with nothing owed: a teammate, or a free-era shortlist. */
    expect(mayPay(app({ round: { shortlistedAt: "y" } }))).toBe(false);
    expect(mayPay(app({ round: { shortlistedAt: "y" }, payment: "awaiting" }))).toBe(true);
    /* Answered without a reference: may still add one. */
    expect(mayPay(app({ round: { shortlistedAt: "y", paymentSubmittedAt: "z" }, payment: "awaiting" }))).toBe(true);
    expect(mayPay(app({ round: { shortlistedAt: "y" }, payment: "paid" }))).toBe(false);
    expect(mayPay(app({ round: { shortlistedAt: "y" }, payment: "paid", status: "confirmed" }))).toBe(false);
  });

  it("never lets an unshortlisted team pay, even with a fee on the row", () => {
    expect(mayPay(app({ payment: "awaiting" }))).toBe(false);
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
