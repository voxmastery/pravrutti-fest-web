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

export type AppStatus = "pending" | "confirmed" | "declined" | "cancelled";
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
export const PAYMENT_REF_HINT =
  "Paste the Transaction Reference No from JUNO's Online Payment Receipt — it is at least 8 letters and digits.";

/**
 * Is this a plausible payment reference?
 *
 * It cannot be confirmed against Juno from here, so this only rejects what
 * obviously is not a receipt: too short, no digit at all, characters a
 * reference never contains, or one character repeated. That keeps "asdf",
 * "------" and a stray keypress from being filed as proof of ₹200, while still
 * accepting every real format — we do not control what Juno issues, so the bar
 * is "could this be a reference", not "is this the right one". An organiser
 * still matches it against the portal's statement.
 */
export function isValidPaymentRef(raw: unknown): boolean {
  const ref = readPaymentRef(raw);
  /* JUNO's Transaction Reference No is 15 characters, the gateway's 16, a UPI
     reference 12 — eight is safely under all of them and above a keyboard mash. */
  if (ref.length < 8 || ref.length > 80) return false;
  // Letters, digits, and the separators receipts actually use.
  if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(ref)) return false;
  /* No digit rule: JUNO's reference is letters and digits in any mix, and a
     genuine one can have no digit at all. Requiring one threw those away. */
  // "00000000", "aaaaaaaa" — a held key, not a reference.
  if (/^(.)\1+$/.test(ref)) return false;
  return true;
}

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
  /** Set on the row written when they left for the payment portal; gone the
      moment they answer how it went, with or without a transaction ID. */
  stage?: "intent";
  decidedAt?: string;
  refundedAt?: string;
  /** An organiser took a decline back once the money was found — who, and
      when. See reinstateApplication in lib/payment-review. */
  reinstatedAt?: string;
  reinstatedBy?: string;
  /** An organiser corrected paymentRef after it was verified — who, and when.
      paymentVerifiedBy still names whoever checked the money itself. */
  paymentRefSetBy?: string;
  paymentRefSetAt?: string;
  /** Registered by their team lead adding them, not by their own hand —
      the organisers' call of 6 Oct 2026 that a lead entering a teammate's
      email has added them. */
  addedByLead?: boolean;
  /** Taken on another platform and imported (lib/external-registrations):
      where, and that platform's own ID for the registration. */
  source?: "unstop";
  externalId?: string;
  /** When the applicant withdrew it themselves. Distinct from decidedAt, which
      records an organiser's decision. */
  cancelledAt?: string;
  /** Set on the row left behind when an organiser moved this team to another
      event: the registration is cancelled here and live over there. */
  movedTo?: { eventId: string; code: string };
  /** Events that run their own rounds before the fee record their progress
      here — today only Discoverize (see lib/discoverize.ts), where entry is
      free and the fee follows a shortlist. Unset everywhere else, so no other
      event's behaviour depends on it. */
  round?: {
    /** When the Google Form actually received their abstract. */
    abstractSubmittedAt?: string;
    /** "form" for the Apps Script webhook, "organiser" for a hand-marked one. */
    abstractSource?: "form" | "organiser";
    /** When the judges put this team through to the presentation round. */
    shortlistedAt?: string;
    /** Who shortlisted them — a coordinator or an organiser, by email. */
    shortlistedBy?: string;
    /** When the shortlisted team's payer answered the pay step, with or
        without a JUNO reference. Back in review from here until an organiser
        verifies the money. */
    paymentSubmittedAt?: string;
  };
  /** Set when a desk scans this ticket in. A second scan reports this time
      rather than replacing it. Cleared only by an undo inside 30 seconds. */
  checkedInAt?: string;
  /** Email of the organiser or coordinator who scanned them in. */
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
  /** The Juno registration ID the portal shows the applicant ("Successfully
      Registered with ID <id>"), entered at registration. Path B's poll key:
      what we ask Juno about to auto-verify the payment. Optional — an
      application without one falls back to manual verification. */
  junoRegId?: string | null;
  /** When the "we have your application" acknowledgement went out, and why it
      did not if it did not. Separate from the confirmation below: they answer
      different questions ("did they hear from us at all" vs "do they have
      their ticket"). */
  receivedEmailAt?: string;
  receivedEmailError?: string | null;
  /** Last "please add your Transaction Reference No" reminder, and how many
      have gone — so a reminder run never nags. */
  referenceReminderAt?: string;
  referenceReminderCount?: number;
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

/** Shown by the form and returned by the API, so both say the same thing. */
export const JUNO_REGID_HINT =
  "After paying, Juno shows “Successfully Registered with ID …” — enter that ID so we can verify your payment automatically.";

/** The Juno registration ID as the applicant pasted it. Bounded and trimmed;
    kept permissive on characters because we do not control Juno's id format. */
export function readJunoRegId(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 40);
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
  cancelled: {
    label: "Cancelled",
    blurb: "You cancelled this registration, so no place is being held. You can apply again while registration is open.",
  },
  declined: {
    label: "Not confirmed",
    blurb: "This event filled up. Registration fees are non-refundable.",
  },
};

/**
 * Status line on the event page. "You're going" is Luma's phrasing for a
 * confirmed ticket — pending stays in review, never that line.
 */
export const EVENT_PAGE_STATUS: Record<AppStatus, string> = {
  pending: "Registration pending approval",
  confirmed: "You\u2019re going",
  declined: "Not confirmed \u00b7 fee non-refundable",
  cancelled: "Registration cancelled",
};

/**
 * Does this application hold a place?
 *
 * Only a registration that is both live and paid for counts. Everything else is
 * an incomplete attempt — somebody who started and never paid, withdrew, or was
 * turned down — and counting those inflates every fill figure and can show an
 * event full while real places sit empty.
 *
 * Paid means the fee is settled or was never owed: verified by an organiser, or
 * a joiner and free entry that owes nothing. An unverified fee counts too, with
 * or without a receipt reference: it is in review. Somebody who left for the
 * payment portal and never came back may well have paid on Juno — the portal
 * gives us no callback, and the reference is the one thing that goes missing
 * when it fails — so the organisers decided (2 Oct 2026) to hold their place
 * until the payment report says otherwise, rather than show their team as
 * not registered. A fee that went back (refunded) does not hold anything.
 */
export function countsAsRegistered(a: {
  status?: AppStatus | string | null;
  payment?: PayStatus | string | null;
  paymentRef?: string | null;
}): boolean {
  if (a.status !== "pending" && a.status !== "confirmed") return false;
  switch (a.payment) {
    case "paid":
    case "not_required":
      return true;
    case "awaiting":
      return true;
    default:
      // "refunded", or anything unrecognised — not a held place.
      return false;
  }
}

/** Submitted and not turned down. Confirmed is a subset. */
export function isLiveApplication(status: AppStatus | null | undefined): boolean {
  return status === "pending" || status === "confirmed";
}
