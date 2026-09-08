import type { Application } from "@/lib/applications";
import { applicationPath, readJsonByPath, putJson } from "@/lib/blob-store";
import { sendConfirmationEmail } from "@/lib/confirmation-email";
import type { SendResult } from "@/lib/mailer";

/**
 * Every write to an application's money/decision fields goes through here.
 *
 * Two surfaces act on the same record — the roster row on /dashboard and the
 * registrations desk on /dashboard/applications — and a rule that lives in
 * only one of them is a rule that will disagree with itself. The transitions
 * and the confirmation email both belong to the record, not to a screen.
 */

export type ReviewOutcome = {
  application: Application;
  mail: SendResult | null;
};

async function load(eventId: string, email: string) {
  const path = applicationPath(eventId, email);
  const record = (await readJsonByPath(path)) as Application | null;
  return { path, record };
}

/**
 * Mail failure never rolls back the decision: the money did arrive, and an
 * organiser who has to click twice because our mail provider blinked will
 * stop trusting the button. The error is stored on the record instead, so the
 * desk can retry the send on its own.
 */
async function persistWithConfirmation(path: string, record: Application): Promise<ReviewOutcome> {
  const mail = await sendConfirmationEmail(record);
  const next: Application = {
    ...record,
    confirmationEmailAt: mail.sent ? new Date().toISOString() : record.confirmationEmailAt,
    confirmationEmailError: mail.sent ? null : mail.error ?? "Mail send failed.",
  };
  await putJson(path, next, true);
  return { application: next, mail };
}

/**
 * Verifying payment also confirms a pending application — the organisers'
 * rule is "approve everyone who has paid", so splitting it into two clicks
 * would only add a step to the case that always happens. A declined
 * application is never revived by a late payment.
 */
export async function verifyPayment(args: { eventId: string; email: string; by: string; paymentRef?: string | null }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;

  const at = new Date().toISOString();
  const confirming = record.status === "pending";
  const joiner = record.payment === "not_required";
  const verified: Application = {
    ...record,
    /* Joiners and free events have nothing to collect. Approving them must
       not rewrite that into "paid" or they show up as having been charged. */
    payment: joiner ? "not_required" : "paid",
    paymentVerifiedAt: joiner ? record.paymentVerifiedAt : at,
    paymentVerifiedBy: joiner ? record.paymentVerifiedBy : args.by,
    paymentRef: joiner
      ? record.paymentRef ?? null
      : args.paymentRef !== undefined
      ? args.paymentRef
      : record.paymentRef ?? null,
    status: confirming ? "confirmed" : record.status,
    decidedAt: confirming ? at : record.decidedAt,
  };

  // Only a confirmed applicant has a ticket to send, so a declined record
  // gets its money recorded without a "you're in" email going out.
  if (verified.status !== "confirmed") {
    await putJson(path, verified, true);
    return { application: verified, mail: null } satisfies ReviewOutcome;
  }

  return persistWithConfirmation(path, verified);
}

/** Undo, because the common failure is a mis-click on the wrong row. */
export async function unverifyPayment(args: { eventId: string; email: string }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;

  const next: Application = {
    ...record,
    payment: "awaiting",
    paymentVerifiedAt: undefined,
    paymentVerifiedBy: undefined,
    // Returns them to the queue, but never un-declines anyone.
    status: record.status === "confirmed" ? "pending" : record.status,
  };
  await putJson(path, next, true);
  return { application: next, mail: null } satisfies ReviewOutcome;
}

export async function declineApplication(args: { eventId: string; email: string }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;

  const at = new Date().toISOString();
  const refunding = record.payment === "paid" || record.payment === "awaiting";
  const next: Application = {
    ...record,
    status: "declined",
    decidedAt: at,
    payment: refunding ? "refunded" : record.payment,
    refundedAt: refunding ? at : record.refundedAt,
  };
  await putJson(path, next, true);
  return { application: next, mail: null } satisfies ReviewOutcome;
}

export async function setPaymentRef(args: { eventId: string; email: string; paymentRef: string | null }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;

  const next: Application = { ...record, paymentRef: args.paymentRef };
  await putJson(path, next, true);
  return { application: next, mail: null } satisfies ReviewOutcome;
}

/** Re-send the ticket. Confirmed only — there is nothing to send otherwise. */
export async function resendConfirmation(args: { eventId: string; email: string }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;
  if (record.status !== "confirmed")
    return { application: record, mail: { sent: false, error: "Only confirmed applicants have a ticket." } } satisfies ReviewOutcome;

  return persistWithConfirmation(path, record);
}
