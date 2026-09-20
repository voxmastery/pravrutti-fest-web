import { NextResponse } from "next/server";
import {
  listAll,
  readPrivate,
  readJsonByPath,
  putJson,
  applicationPath,
  teamPath,
  teamMemberPath,
  paymentRefPath,
} from "@/lib/blob-store";
import { Application, isLiveApplication } from "@/lib/applications";
import { Team, TeamMember, normalizeTeamCode } from "@/lib/teams";
import { events, eventId as slugFor, teamLabel } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Moving a whole team from one event to another.
 *
 * Students pick the wrong event and notice days later, by which time the lead
 * has paid and four people hold places. Telling them to cancel and register
 * again throws away the transaction reference, the queue position and the
 * team code they have already shared — so this rewrites the records instead.
 *
 * Nothing is deleted: the destination is written first, then the source is
 * tombstoned the same way the app already tombstones a deleted team, a
 * removed member and a withdrawn application. If a write fails halfway the
 * team is briefly registered for both events, which an organiser can see and
 * this endpoint can finish — the opposite order could lose them entirely.
 *
 * No email goes out. Somebody asked for this move and is already talking to
 * them; a surprise "your registration was cancelled" from us would read as
 * something going wrong.
 */

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });

type MemberRecord = { code?: string; eventId?: string; member?: TeamMember };

export async function POST(req: Request) {
  if (!authed(req)) return jsonError("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const fromId = String(body?.fromEventId ?? "").trim();
  const toId = String(body?.toEventId ?? "").trim();
  const code = normalizeTeamCode(String(body?.code ?? ""));
  const dryRun = body?.dryRun === true;

  const from = events.find((e) => slugFor(e.name) === fromId);
  const to = events.find((e) => slugFor(e.name) === toId);
  if (!from) return jsonError("That event doesn't exist.", 400);
  if (!to) return jsonError("That destination event doesn't exist.", 400);
  if (fromId === toId) return jsonError("That team is already on that event.", 400);

  const team = (await readJsonByPath(teamPath(fromId, code))) as Team | null;
  if (!team || team.deletedAt) return jsonError("No live team found for that code on that event.", 404);

  /* Raw membership records, not listTeamMembers: the rewrite needs to know
     which key each one lives at, which the member's own email gives us. */
  const rows = await listAll(`team-member/${fromId}/`);
  const raw = await Promise.all(rows.map((b) => readPrivate(b.url)));
  const members = (raw as (MemberRecord | null)[])
    .filter((r): r is MemberRecord => Boolean(r?.member?.email) && normalizeTeamCode(r?.code ?? "") === code)
    .map((r) => r.member!)
    .sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)));

  if (members.length === 0) return jsonError("That team has nobody on it.", 409);
  if (members.length > to.teamSize.max || members.length < to.teamSize.min)
    return jsonError(
      `${to.name} takes ${teamLabel(to).toLowerCase()}, and this team has ${members.length}.`,
      409,
    );

  if (await readJsonByPath(teamPath(toId, code)))
    return jsonError(`${to.name} already has a team with the code ${code}.`, 409);

  /* Everyone's rows on both sides, read before a single write. */
  const plan: { member: TeamMember; source: Application | null; destination: Application | null }[] = [];
  for (const member of members) {
    const [source, destination] = (await Promise.all([
      readJsonByPath(applicationPath(fromId, member.email)),
      readJsonByPath(applicationPath(toId, member.email)),
    ])) as [Application | null, Application | null];
    if (destination && isLiveApplication(destination.status))
      return jsonError(`${member.name} is already registered for ${to.name}.`, 409);
    plan.push({ member, source, destination });
  }

  if (dryRun)
    return NextResponse.json({
      dryRun: true,
      team: { code, name: team.name, from: from.name, to: to.name },
      moving: plan.map((p) => ({
        name: p.member.name,
        email: p.member.email,
        hasApplication: Boolean(p.source),
        status: p.source?.status ?? null,
        payment: p.source?.payment ?? null,
        paymentRef: p.source?.paymentRef ?? null,
        ticketId: p.source?.ticketId ?? null,
        replacesCancelledRow: Boolean(p.destination),
      })),
    });

  const now = new Date().toISOString();
  const movedTo = { eventId: toId, code };

  /* Destination first — a half-done move must leave people registered
     somewhere rather than nowhere. */
  await putJson(teamPath(toId, code), { ...team, eventId: toId }, false);

  for (const { member, source, destination } of plan) {
    await putJson(teamMemberPath(toId, member.email), { code, eventId: toId, member }, true);
    if (!source) continue;
    const moved: Application = {
      ...source,
      eventId: toId,
      eventName: to.name,
      fee: to.fee ?? source.fee,
      teamCode: code,
    };
    await putJson(applicationPath(toId, member.email), moved, Boolean(destination));
    if (source.paymentRef) {
      /* One reference, one entry — the claim has to follow the entry or the
         same receipt reads as somebody else's on the new event. */
      const refPath = paymentRefPath(source.paymentRef);
      const claim = (await readJsonByPath(refPath)) as { claimedAt?: string } | null;
      await putJson(refPath, { eventId: toId, email: member.email, claimedAt: claim?.claimedAt ?? now }, true);
    }
  }

  /* Then unpick the source, in the shapes the rest of the app already reads
     as absent: a tombstoned team, an empty membership code, a cancelled
     application. */
  for (const { member, source } of plan) {
    await putJson(
      teamMemberPath(fromId, member.email),
      { code: "", eventId: fromId, member, removedAt: now, movedTo },
      true,
    );
    if (!source) continue;
    await putJson(
      applicationPath(fromId, member.email),
      { ...source, status: "cancelled", cancelledAt: now, movedTo },
      true,
    );
  }
  await putJson(teamPath(fromId, code), { ...team, deletedAt: now, movedTo }, true);

  return NextResponse.json({
    ok: true,
    moved: plan.length,
    team: { code, name: team.name, from: from.name, to: to.name },
    members: plan.map((p) => ({ name: p.member.name, email: p.member.email, ticketId: p.source?.ticketId ?? null })),
  });
}
