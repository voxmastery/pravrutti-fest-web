import { NextResponse } from "next/server";
import {
  listAll,
  readPrivate,
  readJsonByPath,
  putJson,
  applicationPath,
  teamPath,
  teamMemberPath,
} from "@/lib/blob-store";
import { Application, feeForApplicant } from "@/lib/applications";
import { Team, TeamMember, normalizeTeamCode, memberStatus } from "@/lib/teams";
import { events, eventId as slugFor } from "@/lib/pravrutti-data";
import { newTicketId } from "@/lib/ticket-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finding the people whose money left but whose registration never arrived.
 *
 * Payment happens on the college's JUNO portal, in a tab we do not control and
 * cannot get a callback from. The application row is written only when someone
 * comes back and types their transaction ID, so any break in between — the
 * portal 404ing mid-payment, a closed tab, a lost receipt — takes the money and
 * leaves us nothing.
 *
 * The recovery is that a team outlives the lead's application. Creating a team
 * writes the team and the lead's own member record immediately, while the
 * lead's application is written much later, after payment. A team whose lead
 * has no application is therefore a lead who paid and never made it back, and
 * their name, phone and college are still on their member record — enough to
 * rebuild the row without asking them for anything.
 *
 * This reports rather than repairs. Deciding that money actually arrived is an
 * organiser's call against the college's payment sheet, so a restored row is
 * written as awaiting, never as paid.
 */

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function readAll<T>(prefix: string): Promise<T[]> {
  const blobs = await listAll(prefix);
  const out: T[] = [];
  const CHUNK = 20;
  for (let i = 0; i < blobs.length; i += CHUNK) {
    const batch = await Promise.all(blobs.slice(i, i + CHUNK).map((b) => readPrivate(b.url)));
    for (const r of batch) if (r) out.push(r as T);
  }
  return out;
}

const key = (evId: string, email: string) => `${evId}::${String(email).trim().toLowerCase()}`;

type MemberRecord = { code?: string; eventId?: string; member?: TeamMember };

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [apps, teams, memberRecords] = await Promise.all([
    readAll<Application>("app/"),
    readAll<Team>("team/"),
    readAll<MemberRecord>("team-member/"),
  ]);

  const haveApp = new Set(apps.map((a) => key(a.eventId, a.email)));

  /* A member record rewritten to an empty code is someone who left or was
     removed — not someone missing anything. */
  const liveMembers = memberRecords.filter(
    (r) => r.member?.email && normalizeTeamCode(r.code ?? "") && r.eventId,
  );

  const byTeam = new Map<string, MemberRecord[]>();
  for (const r of liveMembers) {
    const k = `${r.eventId}::${normalizeTeamCode(r.code!)}`;
    byTeam.set(k, [...(byTeam.get(k) ?? []), r]);
  }

  const orphanLeads = teams
    .filter((t) => !t.deletedAt && t.createdByEmail)
    .filter((t) => !haveApp.has(key(t.eventId, t.createdByEmail)))
    .map((t) => {
      const roster = byTeam.get(`${t.eventId}::${normalizeTeamCode(t.code)}`) ?? [];
      const leadRec = roster.find(
        (r) => r.member!.email.toLowerCase() === t.createdByEmail.toLowerCase(),
      );
      const event = events.find((e) => slugFor(e.name) === t.eventId);
      return {
        eventId: t.eventId,
        eventName: event?.name ?? t.eventId,
        code: t.code,
        teamName: t.name,
        createdAt: t.createdAt,
        /* Present unless the lead's own member record is gone too, in which
           case the row has to be rebuilt by hand from the payment sheet. */
        lead: leadRec?.member
          ? {
              name: leadRec.member.name,
              email: leadRec.member.email,
              phone: leadRec.member.phone,
              college: leadRec.member.college,
            }
          : { email: t.createdByEmail, name: null, phone: null, college: null },
        recoverable: Boolean(leadRec?.member),
        teammatesRegistered: roster.filter(
          (r) =>
            r.member!.email.toLowerCase() !== t.createdByEmail.toLowerCase() &&
            haveApp.has(key(t.eventId, r.member!.email)),
        ).length,
        rosterSize: roster.length,
      };
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  /* Accepted teammates with no application of their own. Rarer than a missing
     lead — they owe nothing, so nothing external can interrupt them — but it
     would leave someone off the desk list on the day. */
  const orphanMembers = liveMembers
    .filter((r) => {
      const m = r.member!;
      if (memberStatus(m) !== "joined") return false;
      if (haveApp.has(key(r.eventId!, m.email))) return false;
      const t = teams.find(
        (x) => x.eventId === r.eventId && normalizeTeamCode(x.code) === normalizeTeamCode(r.code!),
      );
      return Boolean(t) && t!.createdByEmail.toLowerCase() !== m.email.toLowerCase();
    })
    .map((r) => ({
      eventId: r.eventId,
      email: r.member!.email,
      name: r.member!.name,
      code: normalizeTeamCode(r.code!),
    }));

  const awaiting = apps
    .filter((a) => a.payment === "awaiting")
    .map((a) => ({
      eventId: a.eventId,
      eventName: a.eventName,
      name: a.name,
      email: a.email,
      paymentRef: (a as any).paymentRef ?? null,
      appliedAt: a.appliedAt,
    }));

  return NextResponse.json({
    summary: {
      applications: apps.length,
      teams: teams.filter((t) => !t.deletedAt).length,
      orphanLeads: orphanLeads.length,
      orphanMembers: orphanMembers.length,
      awaitingVerification: awaiting.length,
    },
    orphanLeads,
    orphanMembers,
    awaiting,
  });
}

/**
 * POST { action: "restore_lead", eventId, code, paymentRef? }
 *
 * Rebuilds the missing application from the team and the lead's member record.
 * Never overwrites an existing row, so running it twice is harmless.
 */
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body?.action !== "restore_lead")
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const evId = String(body?.eventId ?? "").trim();
  const code = normalizeTeamCode(String(body?.code ?? ""));
  const paymentRef = String(body?.paymentRef ?? "").trim();
  if (!evId || !code)
    return NextResponse.json({ error: "Missing eventId or code." }, { status: 400 });

  const event = events.find((e) => slugFor(e.name) === evId);
  if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  const team = (await readJsonByPath(teamPath(evId, code))) as Team | null;
  if (!team || team.deletedAt)
    return NextResponse.json({ error: "No such team." }, { status: 404 });

  const email = String(team.createdByEmail).trim().toLowerCase();
  const existing = await readJsonByPath(applicationPath(evId, email));
  if (existing)
    return NextResponse.json({ error: "That lead already has an application." }, { status: 409 });

  const rec = (await readJsonByPath(teamMemberPath(evId, email))) as MemberRecord | null;
  const lead = rec?.member;
  if (!lead)
    return NextResponse.json(
      { error: "The lead's member record is gone — rebuild this row by hand." },
      { status: 422 },
    );

  const { fee } = feeForApplicant({
    eventFree: event.fee.toLowerCase().startsWith("free"),
    eventFee: event.fee,
    isJoiner: false,
  });

  const app: Application = {
    ticketId: newTicketId(),
    eventId: evId,
    eventName: event.name,
    status: "pending",
    /* Awaiting, never paid: an organiser confirms the money against the
       college's sheet, and that decision records who made it. */
    payment: "awaiting",
    fee,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    college: lead.college,
    teamName: team.name,
    teamCode: team.code,
    members: null,
    appliedAt: team.createdAt,
    ...(paymentRef ? { paymentRef } : {}),
  } as Application;

  await putJson(applicationPath(evId, email), app, false);
  return NextResponse.json({ ok: true, restored: app });
}
