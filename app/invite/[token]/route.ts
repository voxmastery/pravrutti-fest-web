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

function problem(req: Request, reason: string) {
  return NextResponse.redirect(new URL(`/invite/problem?reason=${reason}`, req.url), 303);
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

    const dest = new URL(
      `/teams/${pointer.eventId}/${pointer.code}?t=${token}`,
      req.url,
    );

    if (outcome.alreadyAccepted) return NextResponse.redirect(dest, 303);

    const now = new Date().toISOString();
    const member = acceptedMember(outcome.member, now);
    const event = events.find((e) => slugFor(e.name) === pointer.eventId);

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
        const app: Application = {
          ticketId: newTicketId(),
          eventId: pointer.eventId,
          eventName: event.name,
          status: "pending",
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
        };
        await putJson(applicationPath(pointer.eventId, pointer.email), app, false);
      }
    }

    return NextResponse.redirect(dest, 303);
  } catch (e) {
    console.error("invite accept failed", e);
    return problem(req, "error");
  }
}
