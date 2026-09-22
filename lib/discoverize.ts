import type { Application } from "@/lib/applications";

/**
 * Discoverize runs a different shape of event from the rest of the fest.
 *
 * Everywhere else a team pays to enter. Here nobody pays at all: a team
 * registers for nothing, submits an abstract, and the judges shortlist from
 * those for the presentation round. The rounds still matter — they are what a
 * team's ticket reports — but no stage of them asks for money.
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

/** Free at every stage — entry, shortlist and the presentation round. */
export const DISCOVERIZE_FREE_FEE = "Free";

export type DiscoverizeState =
  | "registered"
  | "abstract_submitted"
  | "shortlisted"
  | "payment_pending"
  | "payment_successful"
  | "final_round_confirmed"
  | "closed";

export const DISCOVERIZE_STATE_LABEL: Record<DiscoverizeState, string> = {
  registered: "Registered",
  abstract_submitted: "Abstract submitted",
  shortlisted: "Shortlisted",
  payment_pending: "Payment pending",
  payment_successful: "Payment successful",
  final_round_confirmed: "Final round confirmed",
  closed: "Closed",
};

export const DISCOVERIZE_STATE_BLURB: Record<DiscoverizeState, string> = {
  registered:
    "Your team is in, and there is nothing to pay. Submit your abstract to be considered for the presentation round.",
  abstract_submitted:
    "We have your abstract. The judges screen every submission and shortlist teams for the presentation round; you will hear from us either way.",
  shortlisted:
    "The judges shortlisted your team for the presentation round. Bring your presentation on a USB drive — there is nothing to pay.",
  /* Unreachable now that nothing is charged — kept so an older row written
     before Discoverize went free still reads as something sensible. */
  payment_pending: "You are through to the presentation round.",
  payment_successful: "You are through to the presentation round.",
  final_round_confirmed:
    "You're in the final round. Bring your presentation and show your QR at the desk.",
  closed: "This registration is closed.",
};

/**
 * The one place that decides where a Discoverize team stands.
 *
 * Read from what already exists — the application's status, its payment, and
 * the round marks — rather than a separate state column that could disagree
 * with them. A column would have to be kept in step with every existing
 * action (verify, decline, withdraw, move); derived, it cannot drift.
 */
export function discoverizeState(
  a: Pick<Application, "status" | "payment"> & { round?: Application["round"] },
): DiscoverizeState {
  if (a.status === "cancelled" || a.status === "declined") return "closed";
  /* An organiser has confirmed the place: for this event that means the
     presentation round. */
  if (a.status === "confirmed") return "final_round_confirmed";
  if (a.payment === "paid") return "payment_successful";
  if (a.round?.shortlistedAt) return a.payment === "awaiting" ? "payment_pending" : "shortlisted";
  if (a.round?.abstractSubmittedAt) return "abstract_submitted";
  return "registered";
}

/**
 * Nobody pays for Discoverize — not to enter, and not after being shortlisted.
 *
 * Kept as a function rather than deleted because the register route asks it
 * before accepting a payment reference: the gate stays explicit, and says no
 * whatever the rest of the flow grows into.
 */
export function mayPay(
  _a: Pick<Application, "status" | "payment"> & { round?: Application["round"] },
): boolean {
  return false;
}

/** The abstract is asked for once, and only while it is still wanted. */
export function maySubmitAbstract(
  a: Pick<Application, "status" | "payment"> & { round?: Application["round"] },
): boolean {
  return discoverizeState(a) === "registered";
}
