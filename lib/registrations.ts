/**
 * Registration / ticket status.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT YET WIRED TO A BACKEND.
 *
 * This site has no database, auth, or payment gateway. `getMyRegistrations`
 * deliberately returns an empty list so the page can never show a participant a
 * registration that does not exist — on a site taking real money, a fabricated
 * "confirmed" row is worse than no row at all.
 *
 * To connect it, replace the body of `getMyRegistrations` with a call to
 * whatever actually holds registrations (your own API route, Unstop's API, a
 * Google Sheet, etc.) and map the response onto the `Registration` shape below.
 * Everything downstream — the status pills, the next-steps copy, the ticket
 * codes — already works off that shape and needs no further changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type RegistrationStatus = "in_process" | "confirmed" | "cancelled";

export interface Registration {
  /** Stable id from the registration system. */
  id: string;
  eventName: string;
  eventCategory: string;
  /** Team name for group events; omit for solo entries. */
  teamName?: string;
  /** Display string exactly as shown elsewhere on the site, e.g. "Free", "Rs. 200/-". */
  amount: string;
  status: RegistrationStatus;
  /** ISO date string. */
  submittedAt: string;
  /** Only present once the registration is confirmed. */
  ticketCode?: string;
}

interface StatusMeta {
  label: string;
  /** The "what happens next" explanation shown under the status. */
  detail: string;
  tone: "pending" | "success" | "error";
}

export const STATUS_META: Record<RegistrationStatus, StatusMeta> = {
  in_process: {
    label: "Registration in process",
    detail:
      "We have received your registration. Once your payment has been confirmed, you will receive an email confirmation at the address you registered with. This usually takes 3–4 days — you do not need to register again.",
    tone: "pending",
  },
  confirmed: {
    label: "Registration confirmed",
    detail:
      "Your payment has been verified and your place is booked. A confirmation email has been sent to you. Bring your ticket code or that email to the registration desk on the day.",
    tone: "success",
  },
  cancelled: {
    label: "Registration not completed",
    detail:
      "This registration was not completed and no place is being held. If you believe your payment went through, contact the coordinators on the Contact page with your payment reference.",
    tone: "error",
  },
};

/** Tailwind classes per tone, so the pills stay consistent wherever they appear. */
export const TONE_CLASSES: Record<StatusMeta["tone"], string> = {
  pending: "text-champagne-gold bg-soft-gold/15 border-soft-gold/45",
  success: "text-success-soft bg-success/15 border-success/45",
  error: "text-danger bg-danger-strong/15 border-danger-strong/45",
};

/**
 * Returns the signed-in participant's registrations.
 *
 * Currently always empty — see the file header. Kept async so swapping in a
 * real fetch requires no signature change at the call sites.
 */
export async function getMyRegistrations(): Promise<Registration[]> {
  return [];
}
