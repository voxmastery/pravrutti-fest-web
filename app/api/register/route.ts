import { NextResponse } from "next/server";
import { events, eventId, capacityFor, effectiveRegistrationOpen, registrationUnavailableMessage } from "@/lib/pravrutti-data";
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
  isValidPaymentRef,
  PAYMENT_REF_HINT,
  readJunoRegId,
  countsAsRegistered,
} from "@/lib/applications";
import { Team, normalizeTeamCode, isValidTeamCode } from "@/lib/teams";
import { cancelApplication } from "@/lib/payment-review";
import { sendReceivedEmail } from "@/lib/received-email";
import { resolveEmail } from "@/lib/identity";
import { resolveRole, resolveRoleFor } from "@/lib/roles";
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
 * GET /api/register            -> { confirmed, pending, confirmedTeams, pendingTeams, open }
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

  /* Only registrations that actually hold a place — see countsAsRegistered.
     An unpaid, withdrawn or declined attempt is an incomplete registration and
     must not occupy a seat in any of these figures. */
  const valid = (records.filter(Boolean) as Application[]).filter(countsAsRegistered);
  for (const r of valid) {
    if (r.status === "confirmed") confirmed[r.eventId] = (confirmed[r.eventId] ?? 0) + 1;
    else if (r.status === "pending") pending[r.eventId] = (pending[r.eventId] ?? 0) + 1;
  }

  /* The same registrations counted as teams, for the events whose field is
     stated in teams. There is one application per person, so a four-person
     team is four records — counting rows would report four teams. Distinct
     team codes, plus one for each entry with no team, is the real figure. */
  const addTeam = (bucket: Record<string, Set<string>>, r: Application) => {
    (bucket[r.eventId] ??= new Set()).add(r.teamCode ? `t:${r.teamCode}` : `s:${r.email}`);
  };
  const confirmedTeamSets: Record<string, Set<string>> = {};
  const pendingTeamSets: Record<string, Set<string>> = {};
  for (const r of valid) {
    if (r.status === "confirmed") addTeam(confirmedTeamSets, r);
    else if (r.status === "pending") addTeam(pendingTeamSets, r);
  }
  const countSets = (b: Record<string, Set<string>>) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.size]));

  const body: any = {
    confirmed,
    pending,
    confirmedTeams: countSets(confirmedTeamSets),
    pendingTeams: countSets(pendingTeamSets),
    open: effectiveRegistrationOpen(),
  };

  if (slug) {
    /* Defensive on both fields: one legacy row without an appliedAt, or with a
       blank name, used to throw here and take the whole endpoint down with it —
       and this endpoint drives the seat counter on every event page, so a
       single bad record blanked all of them. */
    body.going = valid
      .filter((r) => r.eventId === slug && r.status === "confirmed")
      .sort((a, b) => String(b.appliedAt ?? "").localeCompare(String(a.appliedAt ?? "")))
      .slice(0, 24)
      .map((r) => {
        const parts = String(r.name ?? "").trim().split(/\s+/).filter(Boolean);
        const first = parts[0] ?? "Guest";
        return {
          first,
          initials: ((first[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase(),
        };
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
  if (staffBlocksApplication(session.kind, (await resolveRoleFor(email)).kind))
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
    if (!team || team.deletedAt || team.eventId !== evId || team.code !== teamCode)
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
  if (!effectiveRegistrationOpen())
    return NextResponse.json({ error: registrationUnavailableMessage() }, { status: 409 });
  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!isValidPhone(phone))
    return NextResponse.json({ error: PHONE_HINT }, { status: 400 });
  if (college.length < 2 || college.length > 120)
    return NextResponse.json({ error: "Enter your college name." }, { status: 400 });
  /* Most events are team-only. Admitting someone alone there books a place the
     event cannot run — the minimum team size exists for a reason — so this is
     enforced here and not left to the dialog to hide. */
  if (!event.teamSize.soloAllowed && !team)
    return NextResponse.json(
      {
        error: `${event.name} is a team event — create a team or join one with a code before applying. Teams are ${
          event.teamSize.min === event.teamSize.max
            ? `${event.teamSize.min} people`
            : `${event.teamSize.min}\u2013${event.teamSize.max} people`
        }.`,
      },
      { status: 400 }
    );
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
  /* Whoever is charged has just paid on the portal, so the receipt's reference
     is the one thing they can prove it with. It is validated rather than merely
     required: a blank-but-present "asdf" is worse than nothing, because it
     looks like proof on the desk. Joiners are covered by their lead. */
  const paymentRef = isJoiner ? null : readPaymentRef(body?.paymentRef) || null;
  if (payment === "awaiting" && !isValidPaymentRef(paymentRef))
    return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });
  // Path B's poll key. Optional: an application without one simply falls back
  // to manual verification, so it never blocks the form.
  const junoRegId = isJoiner ? null : readJunoRegId(body?.junoRegId) || null;
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
    junoRegId,
    appliedAt: new Date().toISOString(),
  };

  /* A cancelled application is a place they gave up, so applying again is
     allowed and overwrites it. Any other existing record still collides — the
     duplicate guard is what stops one person taking two places. */
  const prior = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
  const replacingCancelled = prior?.status === "cancelled";

  try {
    await putJson(applicationPath(evId, email), record, replacingCancelled);
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

  /* Acknowledge the submission. Somebody has just paid ₹200 on a third-party
     portal and pasted a reference into a form; silence after that reads like
     the money went nowhere, and the expensive mistake it invites is paying a
     second time. Deliberately after the record is saved and never able to undo
     it: a mail outage must not cost someone their place, so the failure is
     recorded on the record and the application still succeeds. */
  const receipt = await sendReceivedEmail(record);
  if (receipt.sent || receipt.error) {
    try {
      await putJson(
        applicationPath(evId, email),
        {
          ...record,
          receivedEmailAt: receipt.sent ? new Date().toISOString() : undefined,
          receivedEmailError: receipt.sent ? null : receipt.error ?? "Mail send failed.",
        },
        true
      );
    } catch (e) {
      console.error("received-email stamp failed", e);
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


/**
 * DELETE /api/register — the applicant withdrawing their own application.
 *
 * Ownership has to be proved, because the record is addressed by email alone:
 * a signed-in visitor is proved by their verified address, and a guest (who
 * registered with an email we never verified) must quote the ticket ID from
 * their own confirmation. Without that, knowing somebody's address would be
 * enough to cancel their place.
 */
export async function DELETE(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }

  const evId = String(body?.eventId ?? "").trim();
  const verified = await resolveEmail();
  const email = (verified ?? String(body?.email ?? "")).trim().toLowerCase();
  if (!evId || !email)
    return NextResponse.json({ error: "Missing event or applicant." }, { status: 400 });

  const record = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
  if (!record) return NextResponse.json({ error: "No registration found." }, { status: 404 });

  if (!verified) {
    const ticketId = String(body?.ticketId ?? "").trim();
    if (!ticketId || ticketId !== record.ticketId)
      return NextResponse.json(
        { error: "Sign in with the email you applied with, or enter your ticket reference to cancel." },
        { status: 403 }
      );
  }

  const outcome = await cancelApplication({ eventId: evId, email });
  if (!outcome) return NextResponse.json({ error: "No registration found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    status: outcome.application.status,
    payment: outcome.application.payment,
    cancelledAt: outcome.application.cancelledAt ?? null,
  });
}
