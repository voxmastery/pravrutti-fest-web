import type { Application } from "@/lib/applications";

/**
 * Discoverize runs a different shape of event from the rest of the fest.
 *
 * Everywhere else a team pays to enter. Here a team registers for nothing,
 * submits an abstract, and the judges shortlist from those for the
 * presentation round. Only a shortlisted team pays — Rs. 200/- for the team,
 * once, by the lead — and only once the coordinators have named it
 * (lib/discoverize-shortlist, and the shortlist desk). Every other
 * Discoverize team stays free.
 *
 * The rest of the fest must not notice. Nothing here changes a shared rule:
 * the flow is expressed as one optional field on the application (`round`)
 * plus the states derived from it, and every other event leaves that field
 * unset and behaves exactly as before.
 */

export const DISCOVERIZE_EVENT_ID = "discoverize-research-paper-presentation";

export const isDiscoverize = (eventId: string | null | undefined) =>
  String(eventId ?? "") === DISCOVERIZE_EVENT_ID;

/** The abstract goes to a Google Form; submissions come back by webhook. */
export const ABSTRACT_FORM_URL = "https://forms.gle/S71f84BEzxu1YrqR8";

/** Entry costs nothing. */
export const DISCOVERIZE_FREE_FEE = "Free";
/** What a shortlisted team pays, once, for the team: the original Discoverize fee. */
export const DISCOVERIZE_ROUND_FEE = "Rs. 200/-";

/** Shown in small green text under a shortlisted team's Pay button — the
    coordinators' own words (Aailyah, 6 Oct 2026). */
export const DISCOVERIZE_SHORTLIST_CONGRATS = "CONGRATULATIONS! YOU HAVE BEEN SHORTLISTED.";

export type DiscoverizeState =
  | "registered"
  | "abstract_submitted"
  | "shortlisted"
  | "payment_pending"
  | "payment_submitted"
  | "payment_successful"
  | "final_round_confirmed"
  | "closed";

export const DISCOVERIZE_STATE_LABEL: Record<DiscoverizeState, string> = {
  registered: "Registered",
  abstract_submitted: "Abstract submitted",
  shortlisted: "Shortlisted",
  payment_pending: "Shortlisted · proceed with payment",
  payment_submitted: "Payment submitted · in review",
  payment_successful: "Payment successful",
  final_round_confirmed: "Final round confirmed",
  closed: "Closed",
};

export const DISCOVERIZE_STATE_BLURB: Record<DiscoverizeState, string> = {
  registered:
    "Your team is in, and entry is free. Submit your abstract to be considered for the presentation round.",
  abstract_submitted:
    "We have your abstract. The judges screen every submission and shortlist teams for the presentation round; you will hear from us either way.",
  shortlisted: "The judges shortlisted your team for the presentation round.",
  payment_pending:
    "You are through to the presentation round. The Rs. 200/- fee is for the team, paid once by the lead on the college's JUNO portal — your place is held while you pay.",
  payment_submitted:
    "We have your payment details. The organisers check every payment against the college's statement, then confirm your place in the presentation round and send your ticket.",
  payment_successful:
    "We have your payment. Your place in the final round is confirmed once the organisers clear it.",
  final_round_confirmed:
    "You're in the final round. Bring your presentation and show your QR at the desk.",
  closed: "This registration is closed.",
};

type RoundRow = Pick<Application, "status" | "payment"> & {
  round?: Application["round"];
  paymentRef?: string | null;
};

/**
 * The one place that decides where a Discoverize team stands.
 *
 * Read from what already exists — the application's status, its payment, and
 * the round marks — rather than a separate state column that could disagree
 * with them. A column would have to be kept in step with every existing
 * action (verify, decline, withdraw, move); derived, it cannot drift.
 */
export function discoverizeState(a: RoundRow): DiscoverizeState {
  if (a.status === "cancelled" || a.status === "declined") return "closed";
  /* An organiser has confirmed the place: for this event that means the
     presentation round. */
  if (a.status === "confirmed") return "final_round_confirmed";
  if (a.payment === "paid") return "payment_successful";
  if (a.round?.shortlistedAt) {
    if (a.payment !== "awaiting") return "shortlisted";
    /* Answered the pay step — with a JUNO reference or without one. Back in
       review, like every other event's paid entry, until it is verified. */
    return a.round?.paymentSubmittedAt || String(a.paymentRef ?? "").trim()
      ? "payment_submitted"
      : "payment_pending";
  }
  if (a.round?.abstractSubmittedAt) return "abstract_submitted";
  return "registered";
}

/**
 * Only a shortlisted team whose payer still owes the round fee may pay, or
 * add its JUNO reference afterwards. A team nobody shortlisted can never
 * reach the fee: the register route asks this before taking a reference.
 */
export function mayPay(a: RoundRow): boolean {
  const s = discoverizeState(a);
  return s === "payment_pending" || s === "payment_submitted";
}

/** The abstract is asked for once, and only while it is still wanted. */
export function maySubmitAbstract(a: RoundRow): boolean {
  return discoverizeState(a) === "registered";
}
