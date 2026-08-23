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
  members: string | null;
  appliedAt: string;
  decidedAt?: string;
  refundedAt?: string;
};

/**
 * Payment gateway is not connected yet. While PAYMENTS_LIVE is false the
 * form collects the application and marks the fee "awaiting" — organisers
 * settle it at the desk and mark it paid in the admin console.
 * Flip this to true once Razorpay keys are in the environment.
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
