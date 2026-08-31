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

/** Every event is ₹200 per participant (lead + teammates). */
export const FEE_PER_HEAD = 200;
/** Max people on one application, including the team lead. */
export const MAX_TEAM_SIZE = 4;

export type Teammate = { name: string; phone: string };

export const formatFee = (heads: number) => `Rs. ${FEE_PER_HEAD * Math.max(heads, 1)}/-`;

export const normalizePhone = (raw: string) => String(raw ?? "").replace(/[^\d+]/g, "");

export const isValidPhone = (raw: string) => /^\+?\d{10,13}$/.test(normalizePhone(raw));

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
};

/**
 * Payment gateway wiring. While PAYMENTS_LIVE is false the form collects the
 * application and marks the fee "awaiting" — organisers send an online payment
 * link and mark it paid in the admin console once settled.
 * Flip this to true once Razorpay (or similar) keys are in the environment.
 */
export const PAYMENTS_LIVE = false;

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
