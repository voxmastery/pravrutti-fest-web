import "server-only";
import { isLiveApplication, type Application } from "@/lib/applications";
import {
  applicationPath,
  invitePath,
  putJson,
  readJsonByPath,
  teamMemberPath,
  teamPath,
} from "@/lib/blob-store";
import { isValidInviteToken, type InvitePointer } from "@/lib/invites";
import { paymentHoldsTeam, PAYMENT_HOLDS_TEAM } from "@/lib/lead-transfer";
import { normalizeTeamCode, type Team, type TeamMember } from "@/lib/teams";

/**
 * Take one person off a team.
 *
 * The lead can do this from their roster. An organiser can do it from the
 * registrations desk or with the admin key — Pauline asked for Prital to be
 * taken off Puzzlers, and that should not depend on the lead being the one
 * signed in. The effects are the same either way: the membership stops
 * counting, the invite link dies, and a live registration is cancelled so
 * the ticket stops working at the gate.
 *
 * The current lead is refused. Removing them would take the team's payment
 * with them; handing the team over, or declining the whole team, is that
 * decision.
 */

export type RemoveResult =
  | { ok: true; application: Application | null; alreadyGone: boolean; teamName: string }
  | { ok: false; status: number; error: string };

type MemberRecord = { code?: string; eventId?: string; member?: TeamMember; removedAt?: string; removedBy?: string };

export async function removeTeammate(args: {
  eventId: string;
  email: string;
  removedBy: string;
  code?: string;
}): Promise<RemoveResult> {
  const evId = args.eventId.trim();
  const email = args.email.trim().toLowerCase();
  if (!evId || !email) return { ok: false, status: 400, error: "Missing event or email." };

  const record = (await readJsonByPath(teamMemberPath(evId, email))) as MemberRecord | null;
  const app = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
  const code = normalizeTeamCode(args.code || record?.code || app?.teamCode || "");
  if (!code) {
    return { ok: true, application: app, alreadyGone: true, teamName: app?.teamName || "" };
  }

  const team = (await readJsonByPath(teamPath(evId, code))) as Team | null;
  if (!team || team.deletedAt) return { ok: false, status: 404, error: "No such team." };
  if (String(team.createdByEmail ?? "").trim().toLowerCase() === email)
    return {
      ok: false,
      status: 409,
      error: "That's the team lead. Hand the team to someone else, or decline the whole team — removing the lead would take its payment with them.",
    };

  const onTeam = !!record && normalizeTeamCode(record.code ?? "") === code;
  const liveHere =
    !!app && normalizeTeamCode(app.teamCode ?? "") === code && isLiveApplication(app.status);
  if (!onTeam && !liveHere) {
    /* A second click, or a teammate the lead already removed: say so instead
       of pretending the team has no such person. */
    const already =
      !!record?.removedAt ||
      (!!record && !normalizeTeamCode(record.code ?? "")) ||
      (!!app && normalizeTeamCode(app.teamCode ?? "") === code && !isLiveApplication(app.status));
    if (already) return { ok: true, application: app, alreadyGone: true, teamName: team.name };
    return { ok: false, status: 404, error: "They're not on this team." };
  }

  if (await paymentHoldsTeam(evId, app, team))
    return { ok: false, status: 409, error: PAYMENT_HOLDS_TEAM };

  const now = new Date().toISOString();
  if (record?.member) {
    await putJson(
      teamMemberPath(evId, email),
      { code: "", eventId: evId, member: record.member, removedAt: now, removedBy: args.removedBy },
      true,
    );
    const spent = record.member.inviteToken;
    if (spent && isValidInviteToken(spent)) {
      const pointer = (await readJsonByPath(invitePath(spent))) as InvitePointer | null;
      if (pointer) await putJson(invitePath(spent), { ...pointer, usedAt: now }, true);
    }
  }

  let next = app;
  if (app && isLiveApplication(app.status)) {
    next = { ...app, status: "cancelled", cancelledAt: now };
    await putJson(applicationPath(evId, email), next, true);
  }

  return { ok: true, application: next, alreadyGone: false, teamName: team.name };
}
