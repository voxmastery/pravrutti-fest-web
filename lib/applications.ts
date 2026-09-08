/**
 * Application lifecycle (GrowthX-style):
 *
 *   submit form ──▶ pay fee ──▶ PENDING (in the queue)
 *                                  │
 *                    organisers review against capacity
 *                                  │
 *                    ┌─────────────┴─────────────┐
 *                    ▼                           ▼
 *                CONFIRMED                    DECLINED
 *              ticket + QR issued          fee refunded in full
 *
 * Free events skip the payment step but still pass through the queue,
 * so every event is confirmed by the same desk process.
 */

export type AppStatus = "pending" | "confirmed" | "declined";
export type PayStatus = "not_required" | "awaiting" | "paid" | "refunded";

/** Team fee, paid once by the lead (or a solo applicant). Joiners do not pay. */
export const FEE_PER_HEAD = 200;
/** Max people on one application, including the team lead. */
export const MAX_TEAM_SIZE = 4;

export type Teammate = { name: string; phone: string };

export const formatFee = (heads: number) => `Rs. ${FEE_PER_HEAD * Math.max(heads, 1)}/-`;

/** Joiner applications carry this instead of a rupee amount. */
export const COVERED_BY_LEAD = "Covered by team lead";

/** Indian mobile numbers are exactly 10 digits, so the field caps there. */
export const PHONE_LENGTH = 10;

/** Charged applicants must supply the transaction ID from their Juno receipt.
    Shown by the form and returned by the API, so both say the same thing. */
export const PAYMENT_REF_HINT = "Enter the transaction ID from your Juno payment receipt.";

/** Shown next to the field and returned by the API, so both read the same. */
export const PHONE_HINT = "Enter a 10-digit mobile number starting with 6-9.";

/**
 * Digits only, with an Indian country/trunk prefix removed. Contact lists and
 * password managers hand over "+91 98765 43210" or "098765 43210", and dropping
 * the prefix keeps the real number instead of leaving the first ten characters
 * of a prefix behind. Deliberately does NOT truncate: a longer run of digits is
 * a typo, not a number to salvage, so isValidPhone rejects it rather than
 * storing a plausible-looking half of what someone meant.
 */
export const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length <= PHONE_LENGTH) return digits;
  const prefix = digits.slice(0, -PHONE_LENGTH);
  return /^(?:0*91|0+)$/.test(prefix) ? digits.slice(-PHONE_LENGTH) : digits;
};

export const isValidPhone = (raw: unknown) => /^[6-9]\d{9}$/.test(normalizePhone(raw));

/**
 * Value for a controlled phone input. Unlike the storage path this does clip to
 * PHONE_LENGTH, so the field simply stops accepting keystrokes at ten digits
 * rather than letting someone type on into an error they cannot see.
 */
export const phoneFieldValue = (raw: unknown) => normalizePhone(raw).slice(0, PHONE_LENGTH);

/**
 * maxLength for a phone input. Wider than PHONE_LENGTH on purpose: browsers
 * apply maxLength to pastes too, and a 10-char cap would chop "+91 98765 43210"
 * down to "+91 98765 " before phoneFieldValue ever saw it — the exact garbage
 * truncation we are avoiding. The rendered value still never exceeds
 * PHONE_LENGTH because every change goes through phoneFieldValue first.
 */
export const PHONE_INPUT_MAX = 16;

export type Application = {
  ticketId: string;
  eventId: string;
  eventName: string;
  status: AppStatus;
  payment: PayStatus;
  fee: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  teamName: string | null;
  /** Short join code for this event; null for solo entries. */
  teamCode?: string | null;
  /** JSON array of { name, phone }, or legacy comma-separated names. */
  members: string | null;
  appliedAt: string;
  decidedAt?: string;
  refundedAt?: string;
  /** Set once when an organiser scans this ticket. Never overwritten —
      a second scan reports the original time rather than replacing it. */
  checkedInAt?: string;
  /** Organiser email that performed the scan. */
  checkedInBy?: string;
  /** When an organiser confirmed the money had actually arrived. */
  paymentVerifiedAt?: string;
  /** Which organiser confirmed it. This is why the shared ADMIN_KEY isn't
      good enough for this action: a decision about money needs a name
      against it, and one password shared by the team gives none. */
  paymentVerifiedBy?: string;
  /** Transaction ID from the applicant's Juno portal receipt, entered at
      registration. The desk verifies it against the statement; it does not
      edit it (the API still accepts set_payment_ref for corrections). */
  paymentRef?: string | null;
  /** When the confirmation email carrying the ticket QR last went out. */
  confirmationEmailAt?: string;
  /** Failure text from the last send attempt, so the desk can see why an
      applicant is still waiting instead of assuming the mail arrived. */
  confirmationEmailError?: string | null;
};

/** The Payment ID the desk should show. Empty when nobody entered one — never invented. */
export function readPaymentRef(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 80);
}

/**
 * Payment gateway wiring. While PAYMENTS_LIVE is false the form collects the
 * application and marks the fee "awaiting" — organisers send an online payment
 * link and mark it paid in the admin console once settled.
 * Flip this to true once Razorpay (or similar) keys are in the environment.
 */
export const PAYMENTS_LIVE = false;

/**
 * Who is charged for this application.
 *
 * Solo entries and team leads pay the team fee once. Someone joining with a
 * code does not — their payment is `not_required` so it cannot sit in the
 * "awaiting" queue or show a pay step.
 */
export function feeForApplicant(args: {
  eventFree: boolean;
  eventFee: string;
  isJoiner: boolean;
}): { payment: PayStatus; fee: string } {
  if (args.eventFree) return { payment: "not_required", fee: args.eventFee };
  if (args.isJoiner) return { payment: "not_required", fee: COVERED_BY_LEAD };
  return { payment: PAYMENTS_LIVE ? "paid" : "awaiting", fee: formatFee(1) };
}

export const STATUS_COPY: Record<AppStatus, { label: string; blurb: string }> = {
  pending: {
    label: "In review",
    blurb: "Your spot is held while the team confirms numbers. You'll hear back before 10 October.",
  },
  confirmed: {
    label: "Confirmed",
    blurb: "You're in. Show your QR at the registration desk.",
  },
  declined: {
    label: "Not confirmed",
    blurb: "This event filled up. Your fee is refunded in full.",
  },
};

/**
 * Status line on the event page. "You're going" is Luma's phrasing for a
 * confirmed ticket — pending stays in review, never that line.
 */
export const EVENT_PAGE_STATUS: Record<AppStatus, string> = {
  pending: "Registration pending approval",
  confirmed: "You\u2019re going",
  declined: "Not confirmed \u00b7 fee refunded in full",
};

/** Submitted and not turned down. Confirmed is a subset. */
export function isLiveApplication(status: AppStatus | null | undefined): boolean {
  return status === "pending" || status === "confirmed";
}
