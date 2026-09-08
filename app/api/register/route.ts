import { NextResponse } from "next/server";
import { events, eventId, capacityFor, registrationOpen, registrationUnavailableMessage } from "@/lib/pravrutti-data";
import { newTicketId } from "@/lib/ticket-id";
import {
  Application,
  MAX_TEAM_SIZE,
  Teammate,
  feeForApplicant,
  isValidPhone,
  normalizePhone,
  PHONE_HINT,
  readPaymentRef,
  PAYMENT_REF_HINT,
} from "@/lib/applications";
import { Team, normalizeTeamCode, isValidTeamCode } from "@/lib/teams";
import { resolveEmail } from "@/lib/identity";
import { resolveRole, roleForEmail } from "@/lib/roles";
import { staffBlocksApplication, STAFF_CANNOT_APPLY } from "@/lib/staff-cockpit";
import {
  listAll,
  readPrivate,
  applicationPath,
  teamPath,
  teamMemberPath,
  readJsonByPath,
  putJson,
} from "@/lib/blob-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { listAll, readPrivate };

/**
 * GET /api/register            -> { confirmed, pending, open }
 * GET /api/register?event=slug -> adds { going: [{ first, initials }] }
 *
 * Only first names and initials ever leave the server.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("event");
  const blobs = await listAll("app/");

  const confirmed: Record<string, number> = {};
  const pending: Record<string, number> = {};
  const records = await Promise.all(blobs.map((b) => readPrivate(b.url)));

  const valid = records.filter(Boolean) as Application[];
  for (const r of valid) {
    if (r.status === "confirmed") confirmed[r.eventId] = (confirmed[r.eventId] ?? 0) + 1;
    else if (r.status === "pending") pending[r.eventId] = (pending[r.eventId] ?? 0) + 1;
  }

  const body: any = { confirmed, pending, open: registrationOpen() };

  if (slug) {
    body.going = valid
      .filter((r) => r.eventId === slug && r.status === "confirmed")
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      .slice(0, 24)
      .map((r) => {
        const parts = r.name.trim().split(/\s+/);
        return { first: parts[0], initials: (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() };
      });
  }

  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable. Refresh and try again." }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  // When signed in, the Google-verified address wins — nobody applies as
  // someone else, and the ticket always lands on an inbox they control.
  const verified = await resolveEmail();
  const email = (verified ?? String(body?.email ?? "")).trim().toLowerCase();
  const session = await resolveRole();
  if (staffBlocksApplication(session.kind, roleForEmail(email).kind))
    return NextResponse.json({ error: STAFF_CANNOT_APPLY }, { status: 403 });
  const phone = normalizePhone(body?.phone);
  const college = String(body?.college ?? "").trim();
  const evId = String(body?.eventId ?? "").trim();

  const membership = (await readJsonByPath(teamMemberPath(evId, email))) as { code?: string } | null;
  const teamCode = normalizeTeamCode(String(body?.teamCode ?? membership?.code ?? ""));

  let team: Team | null = null;
  if (teamCode) {
    if (!isValidTeamCode(teamCode))
      return NextResponse.json({ error: "Enter a valid team code." }, { status: 400 });
    team = (await readJsonByPath(teamPath(evId, teamCode))) as Team | null;
    if (!team || team.eventId !== evId || team.code !== teamCode)
      return NextResponse.json({ error: "No team found for that code." }, { status: 404 });
    const onTeam =
      team.createdByEmail === email ||
      (Array.isArray(team.members) && team.members.some((m) => m.email === email)) ||
      membership?.code === teamCode;
    if (!onTeam)
      return NextResponse.json({ error: "Join this team with the code before applying." }, { status: 403 });
  }

  const teamName = team ? team.name : String(body?.teamName ?? "").trim();

  // Accept structured [{ name, phone }] or legacy comma-separated names.
  // Team-code applications are one person each — roster lives on the team.
  let membersList: Teammate[] = [];
  if (!team) {
    const rawMembers = body?.members;
    if (Array.isArray(rawMembers)) {
      membersList = rawMembers.map((m: any) => ({
        name: String(m?.name ?? "").trim(),
        phone: normalizePhone(m?.phone),
      }));
    } else if (typeof rawMembers === "string" && rawMembers.trim()) {
      membersList = rawMembers
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((n: string) => ({ name: n, phone: "" }));
    }
  }

  const event = events.find((e) => eventId(e.name) === evId);
  if (!event) return NextResponse.json({ error: "That event doesn't exist." }, { status: 400 });
  if (!registrationOpen())
    return NextResponse.json({ error: registrationUnavailableMessage() }, { status: 409 });
  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!isValidPhone(phone))
    return NextResponse.json({ error: PHONE_HINT }, { status: 400 });
  if (college.length < 2 || college.length > 120)
    return NextResponse.json({ error: "Enter your college name." }, { status: 400 });
  if (teamName.length > 80)
    return NextResponse.json({ error: "Team name is too long." }, { status: 400 });
  if (membersList.length > MAX_TEAM_SIZE - 1)
    return NextResponse.json(
      { error: `Teams are capped at ${MAX_TEAM_SIZE} including the lead.` },
      { status: 400 }
    );
  for (let i = 0; i < membersList.length; i++) {
    const m = membersList[i];
    if (m.name.length < 2 || m.name.length > 80)
      return NextResponse.json({ error: `Enter teammate ${i + 1}'s name.` }, { status: 400 });
    // Legacy comma-separated rosters carry names only, so a missing phone there
    // is the shape of the payload rather than something the applicant skipped.
    if (Array.isArray(body?.members) && !isValidPhone(m.phone))
      return NextResponse.json({ error: `Teammate ${i + 1}: ${PHONE_HINT}` }, { status: 400 });
  }

  const isFree = event.fee.toLowerCase().startsWith("free");
  const isJoiner = Boolean(team && team.createdByEmail !== email);
  const { payment, fee } = feeForApplicant({ eventFree: isFree, eventFee: event.fee, isJoiner });
  // Whoever is charged pays on Juno first and proves it with the receipt's
  // transaction ID. `awaiting` is exactly "charged and not yet verified";
  // joiners and free events never reach this branch.
  const paymentRef = isJoiner ? null : readPaymentRef(body?.paymentRef) || null;
  if (payment === "awaiting" && !paymentRef)
    return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });
  const membersPayload =
    membersList.length === 0
      ? null
      : JSON.stringify(membersList.map((m) => ({ name: m.name, phone: m.phone || null })));

  const ticketId = newTicketId();

  const record: Application = {
    ticketId,
    eventId: evId,
    eventName: event.name,
    status: "pending",
    payment,
    fee,
    name,
    email,
    phone,
    college,
    teamName: teamName || null,
    teamCode: team ? team.code : null,
    members: membersPayload,
    // Applicant-supplied, so it is a claim to reconcile rather than proof.
    // Bounded (readPaymentRef) because it is shown verbatim on the desk.
    paymentRef,
    appliedAt: new Date().toISOString(),
  };

  try {
    await putJson(applicationPath(evId, email), record, false);
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return NextResponse.json({ error: "You've already applied for this event." }, { status: 409 });
    console.error("application put failed", e);
    return NextResponse.json({ error: "Your application didn't save. Try again in a moment." }, { status: 500 });
  }

  if (team) {
    // Write only this person's own member record. Previously this read the
    // team, pushed into members[] and rewrote the whole team blob — with no
    // compare-and-swap in Blob, two people registering at once both read the
    // same array and the second write erased the first.
    const existing = await readJsonByPath(teamMemberPath(evId, email));
    const priorJoinedAt = (existing as any)?.member?.joinedAt;
    const entry = {
      name,
      email,
      phone,
      college,
      joinedAt: priorJoinedAt ?? new Date().toISOString(),
    };
    try {
      await putJson(teamMemberPath(evId, email), { code: team.code, eventId: evId, member: entry }, true);
    } catch (e: any) {
      console.error("team roster update failed", e);
    }
  }

  const queue = (await listAll(`app/${evId}/`)).length;

  return NextResponse.json({
    ticketId,
    status: "pending",
    payment: record.payment,
    fee,
    eventName: event.name,
    name,
    queuePosition: queue,
    capacity: capacityFor(evId),
    teamName: record.teamName,
    teamCode: record.teamCode ?? null,
  });
}
