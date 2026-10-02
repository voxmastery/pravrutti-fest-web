import { NextResponse } from "next/server";
import { events, eventId as slugFor } from "@/lib/pravrutti-data";
import { Application, feeForApplicant } from "@/lib/applications";
import { Team, TeamMember } from "@/lib/teams";
import {
  InvitePointer,
  acceptedMember,
  decideAccept,
  isValidInviteToken,
  readInviteToken,
} from "@/lib/invites";
import { newTicketId } from "@/lib/ticket-id";
import { sendConfirmationEmail } from "@/lib/confirmation-email";
import { leadIsConfirmed, leadIsRegistered } from "@/lib/lead-decision";
import { eventIsFull } from "@/lib/event-full";
import { siteOrigin } from "@/lib/mailer";
import {
  applicationPath,
  invitePath,
  putJson,
  readJsonByPath,
  teamMemberPath,
  teamPath,
} from "@/lib/blob-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepting a team invitation.
 *
 * The link from the email lands here, and the token in the path is the only
 * credential — there is no sign-in step, because asking someone to authenticate
 * before they even know what they are agreeing to loses most of them. Holding
 * the token proves control of the mailbox it was sent to, which is the same
 * thing an emailed confirmation link proves anywhere else.
 *
 * Accepting is what earns the member their own application, and so their own
 * ticket. Until they click, they are on the roster but have nothing to show at
 * the desk — their lead can still register the team without them.
 */

/**
 * Where to send somebody, as an address their browser can actually reach.
 *
 * Not `req.url`. Behind the production server that reports the internal bind
 * address, so every redirect from here pointed at https://0.0.0.0:3000 — an
 * accepted invite was recorded and then dumped the person on a page that does
 * not resolve, leaving them certain it had failed. The origin used for the
 * link in the invitation email is the one that got them here, so it is the
 * one that can take them onward. */
function destination(path: string) {
  return new URL(path, siteOrigin());
}

function problem(_req: Request, reason: string) {
  return NextResponse.redirect(destination(`/invite/problem?reason=${reason}`), 303);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await ctx.params;
  const token = readInviteToken(raw);
  if (!isValidInviteToken(token)) return problem(req, "bad-token");

  try {
    const pointer = (await readJsonByPath(invitePath(token))) as InvitePointer | null;
    if (!pointer) return problem(req, "unknown");

    const team = (await readJsonByPath(teamPath(pointer.eventId, pointer.code))) as Team | null;
    const teamExists = Boolean(team && !team.deletedAt);

    const record = (await readJsonByPath(teamMemberPath(pointer.eventId, pointer.email))) as
      | { code?: string; member?: TeamMember }
      | null;
    /* A membership rewritten to an empty code is someone who left or was
       removed: the roster place is gone, so the link is dead too. */
    const onTeam = record?.code === pointer.code ? record?.member ?? null : null;

    const outcome = decideAccept({ pointer, member: onTeam, teamExists });
    if (!outcome.ok) return problem(req, outcome.reason);

    const dest = destination(`/teams/${pointer.eventId}/${pointer.code}?t=${token}`);

    if (outcome.alreadyAccepted) return NextResponse.redirect(dest, 303);

    const now = new Date().toISOString();
    const member = acceptedMember(outcome.member, now);
    const event = events.find((e) => slugFor(e.name) === pointer.eventId);

    /* A full event takes no new teams, and a team whose lead never registered
       is not in it. Turned away before anything is written, so the invite
       stays unspent and works again if the event reopens. */
    if (event && !(await leadIsRegistered(pointer.eventId, team)) && (await eventIsFull(event)))
      return problem(req, "full");

    await putJson(
      teamMemberPath(pointer.eventId, pointer.email),
      { code: pointer.code, eventId: pointer.eventId, member },
      true,
    );
    await putJson(invitePath(token), { ...pointer, usedAt: now }, true);

    /* Their own application, so they get their own ticket and QR. A joiner
       owes nothing — the lead paid for the team — so this never enters the
       payment queue. Skipped if one somehow already exists rather than
       overwriting a record that may already be confirmed. */
    if (event) {
      const existing = await readJsonByPath(applicationPath(pointer.eventId, pointer.email));
      if (!existing) {
        const { payment, fee } = feeForApplicant({
          eventFree: event.fee.toLowerCase().startsWith("free"),
          eventFee: event.fee,
          isJoiner: true,
        });
        /* A team that has already been approved brings its newest member in
           with it. The decision was taken about the team — the fee is the
           lead's one ₹200 and a later member adds nothing to it — so leaving
           them "in review" would hand them a ticket that never moves, waiting
           on an organiser who has already decided. */
        const confirmed = team ? await leadIsConfirmed(pointer.eventId, team) : false;
        const app: Application = {
          ticketId: newTicketId(),
          eventId: pointer.eventId,
          eventName: event.name,
          status: confirmed ? "confirmed" : "pending",
          payment,
          fee,
          name: member.name,
          email: member.email,
          phone: member.phone,
          college: member.college,
          teamName: team?.name ?? null,
          teamCode: pointer.code,
          members: null,
          appliedAt: now,
          ...(confirmed ? { decidedAt: now } : {}),
        };
        const appPath = applicationPath(pointer.eventId, pointer.email);
        await putJson(appPath, app, false);

        /* Best effort, like every other ticket mail: a confirmed place is
           already recorded, and losing the email must not lose the place.

           But the outcome is written down. A refusal that nobody records is
           a student nobody knows to chase — Hostinger throttles this mailbox,
           and teammates sat confirmed-and-silent for days because the result
           of this one send went nowhere. Stamped on the row, they read as
           "no ticket email sent yet" on the desk and the resend queue
           (/api/admin/reconcile, resend_missing) comes back for them. */
        if (confirmed) {
          let outcome: { sent: boolean; error?: string };
          try {
            outcome = await sendConfirmationEmail(app);
          } catch (e) {
            console.error("invite accept: confirmation email failed", e);
            outcome = { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
          }
          await putJson(
            appPath,
            {
              ...app,
              confirmationEmailAt: outcome.sent ? new Date().toISOString() : undefined,
              confirmationEmailError: outcome.sent ? null : outcome.error ?? "Mail send failed.",
            },
            true,
          );
        }
      }
    }

    return NextResponse.redirect(dest, 303);
  } catch (e) {
    console.error("invite accept failed", e);
    return problem(req, "error");
  }
}
