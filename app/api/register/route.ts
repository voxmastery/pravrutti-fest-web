import { NextResponse } from "next/server";
import { runAfterResponse } from "@/lib/after-response";
import { events, eventId, capacityFor, effectiveRegistrationOpen, registrationUnavailableMessage, eventFullMessage, festFor, eventClosedMessage } from "@/lib/pravrutti-data";
import { leadIsRegistered } from "@/lib/lead-decision";
import { isFull, eventIsFull } from "@/lib/event-full";
import { countRegistrationsByEvent, heldRows } from "@/lib/registration-counts";
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
  isLiveApplication,
} from "@/lib/applications";
import { Team, normalizeTeamCode, isValidTeamCode } from "@/lib/teams";
import { cancelApplication } from "@/lib/payment-review";
import { sendReceivedEmail } from "@/lib/received-email";
import { resolveEmail, authRequired } from "@/lib/identity";
import { resolveRole, resolveRoleFor } from "@/lib/roles";
import { staffBlocksApplication, STAFF_CANNOT_APPLY } from "@/lib/staff-cockpit";
import { isDiscoverize, mayPay } from "@/lib/discoverize";
import {
  listAll,
  readPrivate,
  applicationPath,
  teamPath,
  listTeamMembers,
  paymentRefPath,
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

  /* Only registrations that actually hold a place — see heldRows.
     An unpaid, withdrawn or declined attempt is an incomplete registration and
     must not occupy a seat in any of these figures. */
  /* Judged per team (heldRows): a teammate's place stands or falls with
     their lead's, so a team whose lead never paid fills no seat here. */
  const all = records.filter(Boolean) as Application[];
  const holding = heldRows(all);
  const valid = all.filter((r) => holding.has(r));
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

  /* Which events are taking no new teams — switched to full, or holding
     places up to their cap (lib/event-full). The event page reads this to
     say "Full" up front rather than let someone fill in the form first. */
  const held = countRegistrationsByEvent(records.filter(Boolean) as Application[]);
  body.full = Object.fromEntries(
    events.map((e) => {
      const id = eventId(e.name);
      return [id, isFull(e, held.get(id) ?? { people: 0, teams: 0 })];
    }),
  );

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
  /* Where sign-in is configured, the address has to come from the session.
     Taking it from the body let anyone file an application against somebody
     else's email, and a filed application is what blocks that person from
     registering themselves — so a stranger could quietly take their place.
     The form already signs people in, so nothing legitimate travels this way.
     Left open only where auth is off by configuration, which is the Vercel
     test site and local work. */
  if (authRequired() && !verified)
    return NextResponse.json(
      { error: "Sign in to register — your ticket is tied to your email." },
      { status: 401 },
    );
  const email = (verified ?? String(body?.email ?? "")).trim().toLowerCase();

  /* Adding the transaction ID to a registration that already exists.

     They registered when they left to pay, so their name, phone and college
     were taken then. Re-submitting the whole form to attach one field asked
     for those again from a screen that does not show them — the answer came
     back "enter a 10-digit mobile number" with no field to put it in, and the
     registration could not be completed at all. This updates the one thing
     that is actually missing. */
  if (body?.stage === "reference") {
    const evId = String(body?.eventId ?? "").trim();
    const event = events.find((e) => eventId(e.name) === evId);
    if (!event) return NextResponse.json({ error: "That event doesn't exist." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Sign in to add your transaction ID." }, { status: 401 });

    const prior = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
    if (!prior)
      return NextResponse.json(
        { error: "We can't find a registration for you on this event." },
        { status: 404 },
      );
    if (prior.status !== "pending" || prior.payment !== "awaiting")
      return NextResponse.json(
        { error: "There is nothing to add — this registration is not waiting on a payment." },
        { status: 409 },
      );
    /* Discoverize charges only past the shortlist. The check above already
       refuses an unshortlisted team (their payment is "not_required"), but
       this says why, and keeps saying it if the fee ever arrives earlier. */
    if (isDiscoverize(evId) && !mayPay(prior))
      return NextResponse.json(
        { error: "Only teams shortlisted for the presentation round pay the Rs. 200/- fee." },
        { status: 403 },
      );

    const refUnavailable = body?.refUnavailable === true;
    const ref = readPaymentRef(body?.paymentRef) || null;
    if (ref !== null && !isValidPaymentRef(ref))
      return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });
    if (ref === null && !refUnavailable)
      return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });

    /* One receipt, one entry — the same rule the first submit applies. */
    if (ref) {
      const refPath = paymentRefPath(ref);
      try {
        await putJson(refPath, { eventId: evId, email, claimedAt: new Date().toISOString() }, false);
      } catch (e: any) {
        if (/exists|overwrite/i.test(String(e?.message))) {
          const owner = (await readJsonByPath(refPath)) as { eventId?: string; email?: string } | null;
          const mine = owner?.email?.toLowerCase() === email && owner?.eventId === evId;
          if (!mine)
            return NextResponse.json(
              {
                error:
                  "That transaction ID is already recorded against another registration. Each payment covers one entry — check you have copied the right one from your receipt.",
              },
              { status: 409 },
            );
        } else {
          console.error("payment ref claim failed", e);
        }
      }
    }

    /* Answering — with a reference or without — is what closes the intent. */
    const updated: Application = { ...prior, paymentRef: ref, stage: undefined };
    try {
      await putJson(applicationPath(evId, email), updated, true);
    } catch (e) {
      console.error("reference attach failed", e);
      return NextResponse.json(
        { error: "That didn't save. Try again in a moment." },
        { status: 500 },
      );
    }

    /* Acknowledge only if the first submit never managed to. */
    if (!prior.receivedEmailAt)
      await runAfterResponse(async () => {
        const receipt = await sendReceivedEmail(updated);
        if (!(receipt.sent || receipt.error)) return;
        try {
          await putJson(
            applicationPath(evId, email),
            {
              ...updated,
              receivedEmailAt: receipt.sent ? new Date().toISOString() : undefined,
              receivedEmailError: receipt.sent ? null : receipt.error ?? "Mail send failed.",
            },
            true,
          );
        } catch (e) {
          console.error("received-email stamp failed", e);
        }
      });

    return NextResponse.json({
      ticketId: updated.ticketId,
      status: updated.status,
      payment: updated.payment,
      fee: updated.fee,
      eventName: updated.eventName,
      name: updated.name,
      queuePosition: (await listAll(`app/${evId}/`)).length,
      capacity: capacityFor(evId),
      teamName: updated.teamName ?? null,
      teamCode: updated.teamCode ?? null,
      hasPaymentRef: Boolean(updated.paymentRef),
    });
  }

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

  /* Two states the old flow had no room for.

     "intent" is recorded the moment someone leaves for the payment portal,
     before they have anything to prove a payment with. Payment happens on the
     college's site, in a tab we cannot get a callback from, so a registration
     written only on their return is lost to anything that interrupts them —
     the portal failing mid-payment, a closed tab, a lost receipt. Twenty-two
     of thirty-one teams were lost exactly that way. The row goes in first, and
     the reference fills it in later.

     `refUnavailable` is the person who paid and genuinely cannot produce the
     reference, which is the state the portal leaves people in when it fails
     after charging them. Refusing their registration does not make the money
     come back; it only hides them from the desk.  */
  const stage = body?.stage === "intent" ? "intent" : "final";
  const refUnavailable = body?.refUnavailable === true;

  const isFree = event.fee.toLowerCase().startsWith("free");
  const isJoiner = Boolean(team && team.createdByEmail !== email);
  const { payment, fee } = feeForApplicant({ eventFree: isFree, eventFee: event.fee, isJoiner });

  /* A full event takes no new entries (Event.full). Someone already holding a
     live row here is not new: an intent row is a person who left for the
     payment portal before the event filled and may well have paid, and
     refusing them now would not give the money back. Checked before the
     receipt reference is claimed below, so a refused applicant's ID is not
     spent on a registration that never happened. */
  if (await eventIsFull(event)) {
    const entering = isJoiner
      ? !(await leadIsRegistered(evId, team))
      : !isLiveApplication(
          ((await readJsonByPath(applicationPath(evId, email))) as Application | null)?.status,
        );
    if (entering)
      return NextResponse.json({ error: eventFullMessage(event.name) }, { status: 409 });
  }
  /* An event that closed early (Event.registrationCloses) refuses new entries
     the same way a full one does, and for the same reason lets through anyone
     already holding a live row: they left for the payment portal before the
     deadline, may well have paid, and refusing them would not refund it. */
  if (!effectiveRegistrationOpen(undefined, festFor(event))) {
    const holding = isLiveApplication(
      ((await readJsonByPath(applicationPath(evId, email))) as Application | null)?.status,
    );
    if (!holding) return NextResponse.json({ error: eventClosedMessage(event) }, { status: 409 });
  }
  // Whoever is charged pays on Juno first and proves it with the receipt's
  // transaction ID. `awaiting` is exactly "charged and not yet verified";
  // joiners and free events never reach this branch.
  /* Whoever is charged has just paid on the portal, so the receipt's reference
     is the one thing they can prove it with. It is validated rather than merely
     required: a blank-but-present "asdf" is worse than nothing, because it
     looks like proof on the desk. Joiners are covered by their lead. */
  const paymentRef = isJoiner ? null : readPaymentRef(body?.paymentRef) || null;
  /* A present-but-junk reference is still worse than none — it looks like
     proof on the desk — so it is refused whatever the stage. */
  if (paymentRef !== null && !isValidPaymentRef(paymentRef))
    return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });
  if (paymentRef === null && payment === "awaiting" && stage === "final" && !refUnavailable)
    return NextResponse.json({ error: PAYMENT_REF_HINT }, { status: 400 });
  // Path B's poll key. Optional: an application without one simply falls back
  // to manual verification, so it never blocks the form.
  const junoRegId = isJoiner ? null : readJunoRegId(body?.junoRegId) || null;
  const membersPayload =
    membersList.length === 0
      ? null
      : JSON.stringify(membersList.map((m) => ({ name: m.name, phone: m.phone || null })));

  /* One receipt, one entry.

     A reference is the only evidence a payment happened, and nothing stopped
     two people quoting the same one — a shared screenshot registered the
     second of them for nothing, and one payment could be claimed across two
     events. Claiming the reference here is what makes it single-use: the
     write refuses to overwrite, so whoever gets there first holds it.

     Best effort on anything other than a collision. A failure to record the
     claim must not cost somebody who has genuinely paid their place. */
  if (paymentRef) {
    const refPath = paymentRefPath(paymentRef);
    try {
      await putJson(refPath, { eventId: evId, email, claimedAt: new Date().toISOString() }, false);
    } catch (e: any) {
      if (/exists|overwrite/i.test(String(e?.message))) {
        const owner = (await readJsonByPath(refPath)) as { eventId?: string; email?: string } | null;
        const mine =
          owner?.email?.toLowerCase() === email && owner?.eventId === evId;
        if (!mine)
          return NextResponse.json(
            {
              error:
                "That transaction ID is already recorded against another registration. Each payment covers one entry — check you have copied the right one from your receipt.",
            },
            { status: 409 },
          );
      } else {
        console.error("payment ref claim failed", e);
      }
    }
  }

  const prior = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
  /* An intent row is this same person mid-payment: what we wrote when they
     left for the portal, still carrying no reference. Coming back completes
     it rather than colliding with it, and keeps the ticket they were already
     given so nothing they have seen changes underneath them. */
  const completingIntent =
    stage === "final" &&
    prior?.status === "pending" &&
    prior?.payment === "awaiting" &&
    !prior?.paymentRef;

  const ticketId = completingIntent && prior?.ticketId ? prior.ticketId : newTicketId();
  const appliedAt = completingIntent && prior?.appliedAt ? prior.appliedAt : new Date().toISOString();

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
    appliedAt,
    /* Until they come back and answer, this row is a question, not a
       registration. The event page asks it; the final write clears it. */
    ...(stage === "intent" ? { stage: "intent" as const } : {}),
  };

  /* A cancelled application is a place they gave up, so applying again is
     allowed and overwrites it. Any other existing record still collides — the
     duplicate guard is what stops one person taking two places. */
  const replacingCancelled = prior?.status === "cancelled";

  try {
    await putJson(applicationPath(evId, email), record, replacingCancelled || completingIntent);
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

  /* No acknowledgement for an intent row. They have not finished registering
     and have not necessarily paid — mail here would read as a confirmation of
     both. The real submit sends it. */
  if (stage === "intent")
    return NextResponse.json({
      ok: true,
      stage: "intent",
      ticketId,
      payment: record.payment,
      fee,
      eventName: event.name,
    });

  /* Acknowledge the submission. Somebody has just paid ₹200 on a third-party
     portal and pasted a reference into a form; silence after that reads like
     the money went nowhere, and the expensive mistake it invites is paying a
     second time. Deliberately after the record is saved and never able to undo
     it: a mail outage must not cost someone their place, so the failure is
     recorded on the record and the application still succeeds. */
  /* After the response, not inside it. The mail send is a round-trip to an
     SMTP host we do not control, and it has held this request for seventeen
     seconds — on a phone that reads as hung, and that is exactly when someone
     closes the tab. The record is already saved; nothing about the reply
     depends on whether the mail went. */
  await runAfterResponse(async () => {
    const receipt = await sendReceivedEmail(record);
    if (!(receipt.sent || receipt.error)) return;
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
  });

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
    /* Whether they gave us anything to verify against. Somebody who paid but
       could not reach their reference must not be told we are checking one. */
    hasPaymentRef: Boolean(record.paymentRef),
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

  /* A lead cannot walk out from under their own team.

     Teammates pay nothing — their entry is covered by the lead's fee — so a
     lead withdrawing while they are still on the roster would leave a team
     nobody is paying for, and nobody would be told. They take the team apart
     first, which is an action that reaches each teammate, and then withdraw. */
  if (record.teamCode) {
    const team = (await readJsonByPath(teamPath(evId, record.teamCode))) as Team | null;
    if (team && !team.deletedAt && String(team.createdByEmail).toLowerCase() === email) {
      const roster = await listTeamMembers(evId, record.teamCode);
      const others = roster.filter(
        (m: any) => String(m?.email ?? "").toLowerCase() !== email,
      );
      if (others.length > 0)
        return NextResponse.json(
          {
            error:
              `You're the lead of ${team.name}, and ` +
              (others.length === 1 ? "a teammate is" : `${others.length} teammates are`) +
              " still on it. Their entry is covered by yours, so remove them or delete the team first.",
          },
          { status: 409 },
        );
    }
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
