import type { Application } from "@/lib/applications";
import { isLiveApplication } from "@/lib/applications";
import { applicationPath, readJsonByPath, putJson, listAll, readPrivate, teamPath } from "@/lib/blob-store";
import { normalizeTeamCode, type Team } from "@/lib/teams";
import { isDiscoverize } from "@/lib/discoverize";
import { withDiscoverizeShortlist } from "@/lib/discoverize-shortlist";
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
  const loaded = await load(args.eventId, args.email);
  const path = loaded.path;
  if (!loaded.record) return null;
  /* A Discoverize team on the coordinators' shortlist counts as shortlisted
     here too, and its payer as owing the round fee — so verifying it records
     the ₹200 as paid and confirms the team (lib/discoverize-shortlist). */
  const record = await withDiscoverizeShortlist(loaded.record);

  /* Discoverize inverts what this button means.
     Everywhere else confirmed says "your money arrived, you are in".
     Discoverize charges nothing, and discoverizeState reads a confirmed row
     as "Final round confirmed" — the end of a ladder whose earlier rungs are
     submitting an abstract and being shortlisted by the judges. So a single
     press on the desk promoted two teams straight past the screening and
     told them by email they were through to the presentation round.

     Nobody should have to remember that one event of twenty-five means the
     opposite by its own button, so the rule is enforced rather than
     remembered: not shortlisted, not confirmable. A team already through
     stays through; this only refuses the promotion. */
  if (isDiscoverize(record.eventId) && record.status !== "confirmed" && !record.round?.shortlistedAt)
    return { application: record, mail: null } satisfies ReviewOutcome;

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

/**
 * Approving a whole team at once.
 *
 * The fee is ₹200 for the team and the lead pays it, so "has this team paid"
 * is one question with one answer — and approving them one row at a time
 * invites the half-approved team, where teammates wait on a decision that
 * was already taken. Every live member is confirmed together; the money is
 * recorded against the payer alone, because four "paid" stamps would put
 * ₹800 in the books where ₹200 was taken.
 *
 * Members already confirmed and settled are returned untouched rather than
 * re-confirmed: a second press must not put a second ticket in four inboxes.
 */
async function liveTeamMembers(eventId: string, code: string) {
  const normalized = normalizeTeamCode(code);
  if (!normalized) return [];
  /* Scoped to the one event: a team that moved keeps its code, and the rows
     left behind at the old event are not this decision. */
  const blobs = await listAll(`app/${eventId}/`);
  const raw = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  return raw
    .filter((a): a is Application => !!a?.email)
    .filter((a) => normalizeTeamCode(a.teamCode ?? "") === normalized && isLiveApplication(a.status))
    .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
}

export async function verifyTeam(args: {
  eventId: string;
  code: string;
  by: string;
  paymentRef?: string | null;
}) {
  const members = await liveTeamMembers(args.eventId, args.code);
  const code = normalizeTeamCode(args.code);
  const team = code
    ? ((await readJsonByPath(teamPath(args.eventId, code))) as Team | null)
    : null;

  const settled = (a: Application) => a.status === "confirmed" && a.payment !== "awaiting";

  /* In parallel: each write is its own key, and four SMTP round-trips in
     series is the difference between a click and a stall. */
  const outcomes = await Promise.all(
    members.map(async (m) => {
      if (settled(m)) return { application: m, mail: null } satisfies ReviewOutcome;
      return (await verifyPayment({
        eventId: args.eventId,
        email: m.email,
        by: args.by,
        /* A reference read off the statement belongs to whoever paid, and
           joiners have nothing to attach it to. */
        paymentRef: m.payment === "not_required" ? undefined : args.paymentRef,
      }))!;
    }),
  );

  /* Teammates the lead added who never accepted have no row yet. Verifying
     the team is the decision that they are in, so they are registered and
     emailed here rather than left INVITED on a confirmed team. */
  const { enrollInvitedTeammates } = await import("@/lib/added-members");
  const enrolled = team && !team.deletedAt
    ? await enrollInvitedTeammates({
        evId: args.eventId,
        code: team.code,
        teamName: team.name || members[0]?.teamName || "Team",
        confirmed: true,
      })
    : [];

  if (members.length === 0 && enrolled.length === 0) return null;

  return {
    applications: [...outcomes.map((o) => o.application), ...enrolled],
    /* Enroll already sent (and stamped) the ticket. Report that send so the
       desk can say how many emails went out, without sending a second one. */
    mails: [
      ...outcomes.map((o) => o.mail),
      ...enrolled.map((a) =>
        a.confirmationEmailAt
          ? { sent: true }
          : a.confirmationEmailError
            ? { sent: false, error: a.confirmationEmailError }
            : null,
      ),
    ],
  };
}

/**
 * Verifying the payer, from the desk's per-person button.
 *
 * Each row has its own "Verify payment" and each team block its own "Confirm
 * team", and the per-person one used to confirm the payer alone. Their
 * teammates stayed in review behind a decision already taken, and nothing on
 * the desk would ever come back for them — sixteen teams in one day.
 *
 * The fee is one payment for the team, so once the payer's money is verified
 * the people it covers are confirmed too. Only those people: a teammate who
 * owes nothing (not_required) and is still waiting. Nobody else is marked as
 * having paid, a withdrawn teammate stays withdrawn, and verifying a
 * teammate's own row confirms that teammate alone — their row is no evidence
 * of the payer's money, so it must not approve it.
 */
export async function verifyPayer(args: {
  eventId: string;
  email: string;
  by: string;
  paymentRef?: string | null;
}) {
  const outcome = await verifyPayment(args);
  if (!outcome) return null;

  const a = outcome.application;
  const coversOthers = a.status === "confirmed" && a.payment !== "not_required" && !!a.teamCode;
  if (!coversOthers) return { ...outcome, teammates: [] as Application[] };

  const waiting = (await liveTeamMembers(args.eventId, a.teamCode!)).filter(
    (m) => m.email !== a.email && m.status === "pending" && m.payment === "not_required",
  );
  const moved = await Promise.all(
    waiting.map((m) => verifyPayment({ eventId: args.eventId, email: m.email, by: args.by })),
  );
  const teammates = moved.filter((o): o is NonNullable<typeof o> => !!o).map((o) => o.application);

  /* And the ones who were only invited: no application, so the loop above
     never saw them. Dev Dynamos' two INVITED places were this case. */
  const { enrollInvitedTeammates } = await import("@/lib/added-members");
  const team = (await readJsonByPath(teamPath(args.eventId, normalizeTeamCode(a.teamCode!)!))) as Team | null;
  const enrolled = team && !team.deletedAt
    ? await enrollInvitedTeammates({
        evId: args.eventId,
        code: team.code,
        teamName: team.name || a.teamName || "Team",
        confirmed: true,
      })
    : [];

  return {
    ...outcome,
    teammates: [...teammates, ...enrolled],
  };
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

/**
 * Taking a decline back once the money turns up.
 *
 * verifyPayment never revives a declined registration, and should not: a
 * payment arriving late is not a decision to let someone in. But a decline
 * made because the money had not shown up yet is wrong once it has, and the
 * desk had no way back — Ruhan's Respawn row sat "declined, paid" for two
 * weeks while his three teammates held tickets on the fee he paid.
 *
 * So this is the way back, and only for that case: the row is declined and
 * its money is verified. A refunded fee went back to the student, and with
 * nothing verified there is nothing to stand on; both are refused. It names
 * the organiser who decided, clears the refund the decline stamped on money
 * that never actually went back, and sends the ticket.
 */
export type ReinstateResult =
  | { outcome: ReviewOutcome }
  | { refused: "missing" | "not_declined" | "not_paid" };

export async function reinstateApplication(args: {
  eventId: string;
  email: string;
  by: string;
  paymentRef?: string | null;
}): Promise<ReinstateResult> {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return { refused: "missing" };
  if (record.status !== "declined") return { refused: "not_declined" };
  if (record.payment !== "paid" || !record.paymentVerifiedAt) return { refused: "not_paid" };

  const at = new Date().toISOString();
  const { refundedAt: _voided, ...rest } = record;
  const next: Application = {
    ...rest,
    status: "confirmed",
    decidedAt: at,
    reinstatedAt: at,
    reinstatedBy: args.by,
    paymentRef: args.paymentRef ? args.paymentRef : record.paymentRef ?? null,
  };
  return { outcome: await persistWithConfirmation(path, next) };
}

/**
 * Turning a whole team away.
 *
 * The other half of the team decision. Declining the lead alone refunds the
 * only fee that was taken and leaves the teammates pending on a place nobody
 * is paying for — so they go together. The refund is stamped on whoever
 * actually paid; teammates were never charged, and three invented refunds
 * would be three entries to explain at the desk.
 */
export async function declineTeam(args: { eventId: string; code: string }) {
  const members = await liveTeamMembers(args.eventId, args.code);
  if (members.length === 0) return null;

  const outcomes = await Promise.all(
    members.map((m) => declineApplication({ eventId: args.eventId, email: m.email })),
  );
  return {
    applications: outcomes.flatMap((o) => (o ? [o.application] : [])),
    mails: [],
  };
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

/**
 * The applicant withdrawing their own application.
 *
 * Distinct from declineApplication, which is the organisers turning someone
 * down: the place is freed either way, but the reason matters to the desk and
 * to the person. The row is kept rather than deleted so a cancellation stays
 * visible and a collected fee keeps its refund trail.
 */
export async function cancelApplication(args: { eventId: string; email: string }) {
  const { path, record } = await load(args.eventId, args.email);
  if (!record) return null;

  // An organiser already closed this one; their decision and its refund trail
  // outrank a late cancel.
  if (record.status === "declined")
    return { application: record, mail: null } satisfies ReviewOutcome;
  // Idempotent: a second cancel must report the first one, not restamp it.
  if (record.status === "cancelled")
    return { application: record, mail: null } satisfies ReviewOutcome;

  const at = new Date().toISOString();
  // Only money that actually arrived can be refunded. "awaiting" was never
  // collected, and a joiner's fee belongs to their lead.
  const refunding = record.payment === "paid";
  const next: Application = {
    ...record,
    status: "cancelled",
    cancelledAt: at,
    payment: refunding ? "refunded" : record.payment,
    refundedAt: refunding ? at : record.refundedAt,
  };
  await putJson(path, next, true);
  return { application: next, mail: null } satisfies ReviewOutcome;
}
