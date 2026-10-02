import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { events, eventId, capacityFor, effectiveRegistrationOpen, registrationUnavailableMessage, eventFullMessage, festFor, eventClosedMessage } from "@/lib/pravrutti-data";
import {
  Application,
  PHONE_HINT,
  feeForApplicant,
  isValidPhone,
  isLiveApplication,
  normalizePhone,
} from "@/lib/applications";
import {
  InvitePointer,
  canAddMember,
  invitedMember,
  isValidInviteToken,
  isValidMemberEmail,
  newInviteToken,
  normalizeMemberEmail,
  readAddMember,
  readInviteToken,
} from "@/lib/invites";
import { inviteUrl, sendInviteEmail } from "@/lib/invite-email";
import { sendConfirmationEmail } from "@/lib/confirmation-email";
import { leadIsConfirmed, leadIsRegistered } from "@/lib/lead-decision";
import { eventIsFull } from "@/lib/event-full";
import {
  Team,
  TeamMember,
  TEAM_CODE_LENGTH,
  MAX_TEAM_BIO,
  normalizeTeamCode,
  isValidTeamCode,
  toTeamPreview,
  maxTeamSizeFor,
} from "@/lib/teams";
import { resolveEmail, authRequired } from "@/lib/identity";
import { resolveRole, resolveRoleFor } from "@/lib/roles";
import { staffBlocksApplication, STAFF_CANNOT_APPLY } from "@/lib/staff-cockpit";
import { newTicketId } from "@/lib/ticket-id";
import {
  listAll,
  readPrivate,
  applicationPath,
  teamPath,
  teamMemberPath,
  invitePath,
  readJsonByPath,
  putJson,
  listTeamMembers,
} from "@/lib/blob-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTeamCode() {
  const bytes = randomBytes(TEAM_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < TEAM_CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveApplicantEmail(bodyEmail: string) {
  const verified = await resolveEmail();
  if (authRequired()) {
    if (!verified) return { error: jsonError("Sign in to create or join a team.", 401) };
    return { email: verified };
  }
  const email = (verified ?? bodyEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)
    return { error: jsonError("Enter a valid email address.", 400) };
  return { email };
}

function findEvent(evId: string) {
  return events.find((e) => eventId(e.name) === evId) ?? null;
}

async function loadTeam(evId: string, code: string): Promise<Team | null> {
  const raw = await readJsonByPath(teamPath(evId, code));
  if (!raw || typeof raw !== "object") return null;
  const team = raw as Team;
  if (team.eventId !== evId || team.code !== code) return null;
  // Tombstoned by its lead — absent for every purpose (verify, join, mine).
  if (team.deletedAt) return null;
  if (!Array.isArray(team.members)) team.members = [];
  return team;
}

/**
 * The team this person is on, if it still exists.
 *
 * A membership record outlives its team: leaving tombstones it (code ""),
 * and a lead deleting the team does not touch it at all, so it keeps
 * pointing at something gone. Every "already on a team" check has to ask
 * whether that team is alive, or the person is locked out of the event by
 * a team they themselves dissolved.
 */
async function liveMembershipCode(evId: string, email: string): Promise<string | null> {
  const membership = (await readJsonByPath(teamMemberPath(evId, email))) as { code?: string } | null;
  const code = normalizeTeamCode(membership?.code ?? "");
  if (!isValidTeamCode(code)) return null;
  return (await loadTeam(evId, code)) ? code : null;
}

/** A live registration whose team the lead has since deleted. */
async function teamGoneFor(evId: string, app: Application | null): Promise<boolean> {
  const code = normalizeTeamCode(String(app?.teamCode ?? ""));
  if (!isValidTeamCode(code)) return false;
  return (await loadTeam(evId, code)) === null;
}

function blobFailed(e: unknown, label: string) {
  console.error(label, e);
  return jsonError("Couldn't reach team storage. Try again in a moment.", 500);
}

async function previewResponse(team: Team, maxMembers: number, includeRoster = false) {
  const members = await listTeamMembers(team.eventId, team.code);
  return NextResponse.json(toTeamPreview(team, members, maxMembers, includeRoster), {
    headers: { "cache-control": "no-store" },
  });
}

async function verifyTeam(evId: string, rawCode: string, bodyEmail: string) {
  const code = normalizeTeamCode(rawCode);
  const event = findEvent(evId);
  if (!evId || !event) return jsonError("That event doesn't exist.", 400);
  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);
  try {
    const team = await loadTeam(evId, code);
    if (!team) return jsonError("No team found for that code.", 404);

    /* Whether the person looking is one the lead already added. Each
       unaccepted invite holds a place, so the team they were invited to can
       read full to them — and joinTeam lets them in regardless. The viewer is
       resolved exactly as joinTeam will resolve them, so the two agree; it
       only ever says whether *your own* address is on the list. */
    const signedIn = await resolveEmail();
    const viewer = (signedIn ?? (authRequired() ? "" : bodyEmail)).trim().toLowerCase();
    const members = await listTeamMembers(team.eventId, team.code);
    const invited =
      !!viewer &&
      viewer !== String(team.createdByEmail ?? "").toLowerCase() &&
      members.some((m: TeamMember) => String(m.email ?? "").toLowerCase() === viewer);

    return NextResponse.json(
      { ...toTeamPreview(team, members, maxTeamSizeFor(event)), ...(invited ? { invited: true } : {}) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return blobFailed(e, "team verify failed");
  }
}

/** Restore the caller's existing team for this event — code never regenerates. */
async function mineTeam(evId: string, bodyEmail: string) {
  const event = findEvent(evId);
  if (!evId || !event) return jsonError("That event doesn't exist.", 400);
  const who = await resolveApplicantEmail(bodyEmail);
  if ("error" in who) return who.error;
  try {
    const membership = (await readJsonByPath(teamMemberPath(evId, who.email))) as { code?: string } | null;
    const code = normalizeTeamCode(membership?.code ?? "");
    if (!isValidTeamCode(code)) return NextResponse.json({ team: null }, { headers: { "cache-control": "no-store" } });
    const team = await loadTeam(evId, code);
    if (!team) return NextResponse.json({ team: null }, { headers: { "cache-control": "no-store" } });
    const members = await listTeamMembers(evId, code);
    return NextResponse.json(
      {
        team: {
          ...toTeamPreview(team, members, maxTeamSizeFor(event), true),
          isLead: String(team.createdByEmail).toLowerCase() === who.email.toLowerCase(),
          canInvite: effectiveRegistrationOpen(undefined, festFor(event)),
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return blobFailed(e, "team mine failed");
  }
}

function personApplication(args: {
  event: (typeof events)[number];
  evId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  team: Team;
  /* An approved team brings its newest member in with it — see
     lib/lead-decision. The invite link has always done this; typing the team
     code in did not, so the same student got a different answer depending on
     which way their lead added them. */
  confirmed: boolean;
}): Application {
  const { payment, fee } = feeForApplicant({
    eventFree: args.event.fee.toLowerCase().startsWith("free"),
    eventFee: args.event.fee,
    isJoiner: true,
  });
  const now = new Date().toISOString();
  return {
    ticketId: newTicketId(),
    eventId: args.evId,
    eventName: args.event.name,
    status: args.confirmed ? "confirmed" : "pending",
    payment,
    fee,
    name: args.name,
    email: args.email,
    phone: args.phone,
    college: args.college,
    teamName: args.team.name,
    teamCode: args.team.code,
    members: null,
    appliedAt: now,
    ...(args.confirmed ? { decidedAt: now } : {}),
  };
}

async function createTeam(body: any) {
  if (!effectiveRegistrationOpen()) return jsonError(registrationUnavailableMessage(), 409);

  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);
  /* An event can close before the fest-wide date (Event.registrationCloses). */
  if (!effectiveRegistrationOpen(undefined, festFor(event))) return jsonError(eventClosedMessage(event), 409);
  /* A new team is exactly what a full event is not taking. */
  if (await eventIsFull(event)) return jsonError(eventFullMessage(event.name), 409);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;
  const email = who.email;
  const session = await resolveRole();
  if (staffBlocksApplication(session.kind, (await resolveRoleFor(email)).kind))
    return jsonError(STAFF_CANNOT_APPLY, 403);

  const name = String(body?.name ?? "").trim();
  const bio = String(body?.bio ?? "").trim();
  const leadName = String(body?.leadName ?? "").trim();
  const phone = normalizePhone(body?.phone);
  const college = String(body?.college ?? "").trim();

  if (name.length < 2 || name.length > 80) return jsonError("Enter a team name.", 400);
  if (bio.length > MAX_TEAM_BIO) return jsonError("Team bio is too long.", 400);
  if (leadName.length < 2 || leadName.length > 80) return jsonError("Enter your full name.", 400);
  if (!isValidPhone(phone)) return jsonError(PHONE_HINT, 400);
  if (college.length < 2 || college.length > 120) return jsonError("Enter your college name.", 400);

  /* Leaving or being removed tombstones the membership rather than deleting
     it — the store has no delete — so the write further down is allowed to
     replace that tombstone. Without this, anyone who had ever left a team
     could never create one. */
  let tombstonedMembership = false;
  /* Their registration, when it names a team they have since deleted. It
     moves to the new team below rather than blocking it: a lead who dissolved
     their team and made another has not registered twice. */
  let repointApp: Application | null = null;

  try {
    /* A cancelled application is a place they gave up, so it must not stand
       in the way of taking another. Removing somebody from a team cancels
       theirs, and treating that as a live duplicate locked them out of the
       event completely: they could not join another team, create one, rejoin,
       or be invited back. The register route has always read it this way. */
    const existingApp = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
    if (existingApp && isLiveApplication(existingApp.status)) {
      if (!(await teamGoneFor(evId, existingApp)))
        return jsonError("You've already applied for this event.", 409);
      repointApp = existingApp;
    }

    const existingMembership = await readJsonByPath(teamMemberPath(evId, email));
    const liveCode = await liveMembershipCode(evId, email);
    if (liveCode) {
      const existing = (await loadTeam(evId, liveCode))!;
      const members = await listTeamMembers(evId, liveCode);
      return NextResponse.json({
        ...toTeamPreview(existing, members, maxTeamSizeFor(event), true),
        created: false,
        restored: true,
      });
    }
    /* Any membership record with no live team behind it — left, removed, or
       the team deleted — is a tombstone the write below may replace. */
    tombstonedMembership = Boolean(existingMembership);
  } catch (e) {
    return blobFailed(e, "team create precheck failed");
  }

  const lead: TeamMember = {
    name: leadName,
    email,
    phone,
    college,
    joinedAt: new Date().toISOString(),
  };

  let team: Team | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateTeamCode();
    const record: Team = {
      code,
      eventId: evId,
      name,
      bio,
      createdByEmail: email,
      members: [lead],
      createdAt: new Date().toISOString(),
    };
    try {
      await putJson(teamPath(evId, code), record, false);
      team = record;
      break;
    } catch (e: any) {
      if (/exists|overwrite/i.test(String(e?.message))) continue;
      console.error("team create failed", e);
      return jsonError("Your team didn't save. Try again in a moment.", 500);
    }
  }

  if (!team) return jsonError("Couldn't mint a unique team code. Try again.", 500);

  try {
    await putJson(teamMemberPath(evId, email), { code: team.code, eventId: evId, member: lead }, tombstonedMembership);
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return jsonError("You're already on a team for this event.", 409);
    console.error("team membership put failed", e);
    return jsonError("Your team didn't save. Try again in a moment.", 500);
  }

  if (repointApp) {
    try {
      await putJson(
        applicationPath(evId, email),
        { ...repointApp, teamCode: team.code, teamName: team.name },
        true,
      );
    } catch (e) {
      /* The team exists and they lead it; a registration still naming the old
         one is a mismatch an organiser can see, not a lost place. */
      console.error("application re-point failed", e);
    }
  }

  return NextResponse.json({ ...toTeamPreview(team, [lead], maxTeamSizeFor(event), true), created: true });
}

async function joinTeam(body: any) {
  if (!effectiveRegistrationOpen()) return jsonError(registrationUnavailableMessage(), 409);

  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);
  /* An event can close before the fest-wide date (Event.registrationCloses). */
  if (!effectiveRegistrationOpen(undefined, festFor(event))) return jsonError(eventClosedMessage(event), 409);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;
  const email = who.email;
  const session = await resolveRole();
  if (staffBlocksApplication(session.kind, (await resolveRoleFor(email)).kind))
    return jsonError(STAFF_CANNOT_APPLY, 403);

  const code = normalizeTeamCode(String(body?.code ?? ""));
  const name = String(body?.name ?? "").trim();
  const phone = normalizePhone(body?.phone);
  const college = String(body?.college ?? "").trim();

  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);
  if (name.length < 2 || name.length > 80) return jsonError("Enter your full name.", 400);
  if (!isValidPhone(phone)) return jsonError(PHONE_HINT, 400);
  if (college.length < 2 || college.length > 120) return jsonError("Enter your college name.", 400);

  let team: Team;
  /* Their own cancelled row is the one thing the write below may replace. */
  let replacingCancelled = false;
  try {
    const existingApp = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
    if (existingApp && isLiveApplication(existingApp.status)) {
      /* A lead who deleted their team still holds the registration (and the
         fee) for it. Joining somebody else's team under it would leave one
         person paying twice over, so this one asks them to withdraw first. */
      if (await teamGoneFor(evId, existingApp))
        return jsonError(
          "You're registered for this event as the lead of a team you deleted. Withdraw that registration from My tickets first, then join this team.",
          409,
        );
      return jsonError("You've already applied for this event.", 409);
    }
    replacingCancelled = existingApp?.status === "cancelled";

    const prior = await liveMembershipCode(evId, email);
    if (prior && prior !== code)
      return jsonError("You're already on a different team for this event.", 409);

    const found = await loadTeam(evId, code);
    if (!found) return jsonError("No team found for that code.", 404);
    team = found;
  } catch (e) {
    return blobFailed(e, "team join precheck failed");
  }

  /* A full event still lets people onto a team that is already in it — that
     adds no team. A team whose lead never registered is not in it and cannot
     get in now, so joining it would only strand them in review. */
  if (!(await leadIsRegistered(evId, team)) && (await eventIsFull(event)))
    return jsonError(eventFullMessage(event.name), 409);

  const maxMembers = maxTeamSizeFor(event);
  const roster = await listTeamMembers(evId, code);
  const alreadyMember = roster.some((m: any) => String(m.email ?? "").toLowerCase() === email);
  if (alreadyMember && team.createdByEmail === email)
    return jsonError("You're the team lead — continue to submit your application.", 409);

  if (!alreadyMember && roster.length >= maxMembers)
    return jsonError(`This team is full (${maxMembers} including the lead).`, 409);

  const joiner: TeamMember = {
    name,
    email,
    phone,
    college,
    joinedAt: new Date().toISOString(),
  };

  // No write to the team blob here — each joiner owns their own record, so two
  // people joining at once write different keys instead of overwriting one array.
  try {
    await putJson(teamMemberPath(evId, email), { code, eventId: evId, member: joiner }, true);
  } catch (e: any) {
    console.error("team membership put failed", e);
    return jsonError("Couldn't add you to this team. Try again in a moment.", 500);
  }

  const confirmed = await leadIsConfirmed(evId, team);
  const record = personApplication({ event, evId, name, email, phone, college, team, confirmed });
  const appPath = applicationPath(evId, email);
  try {
    await putJson(appPath, record, replacingCancelled);
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return jsonError("You've already applied for this event.", 409);
    console.error("application put failed", e);
    return jsonError("Your application didn't save. Try again in a moment.", 500);
  }

  /* A confirmed place has a ticket, so it is sent — best effort, because the
     place is already recorded and losing the email must not lose it. The
     outcome is written down either way: the mailbox is throttled, and a
     refusal nobody records is a confirmed student nobody knows has not been
     told. Stamped here, they read as "no ticket email sent yet" on the desk
     and the resend queue comes back for them. */
  if (confirmed) {
    let outcome: { sent: boolean; error?: string };
    try {
      outcome = await sendConfirmationEmail(record);
    } catch (e) {
      console.error("team join: confirmation email failed", e);
      outcome = { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
    }
    await putJson(
      appPath,
      {
        ...record,
        confirmationEmailAt: outcome.sent ? new Date().toISOString() : undefined,
        confirmationEmailError: outcome.sent ? null : outcome.error ?? "Mail send failed.",
      },
      true,
    );
  }

  const queue = (await listAll(`app/${evId}/`)).length;

  return NextResponse.json({
    ticketId: record.ticketId,
    status: "pending",
    payment: record.payment,
    fee: record.fee,
    eventName: event.name,
    name,
    queuePosition: queue,
    capacity: capacityFor(evId),
    teamName: team.name,
    teamCode: team.code,
    memberCount: alreadyMember ? roster.length : roster.length + 1,
    maxMembers,
  });
}

/**
 * GET  /api/teams?event=&code=          -> team preview (name, bio, member count)
 * GET  /api/teams?event=&mine=1         -> caller's existing team + {name,email} roster
 * POST /api/teams { action: "verify" }  -> same preview (no member emails)
 * POST /api/teams { action: "mine" }    -> same as GET mine
 * POST /api/teams { action: "create" }  -> mint a code (auth required); restores if already created
 * POST /api/teams { action: "join" }    -> add member + create their application
 *                                         (allowed after the lead has submitted,
 *                                         until event.teamSize.max is reached)
 */

/**
 * The lead deleting their own team.
 *
 * Soft, because the store has no delete: the record is tombstoned with
 * deletedAt and loadTeam treats it as gone, so verify/join/mine all stop
 * finding it. Members' own applications survive — they simply stop belonging
 * to a team, which is the honest outcome of the lead dissolving it.
 */
async function deleteTeam(body: any) {
  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!evId || !event) return jsonError("That event doesn't exist.", 400);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;

  const code = normalizeTeamCode(String(body?.code ?? ""));
  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);

  try {
    const team = await loadTeam(evId, code);
    if (!team) return jsonError("No team found for that code.", 404);
    if (team.createdByEmail !== who.email)
      return jsonError("Only the team lead can delete this team.", 403);

    /* Deleting only tombstones the team. It does not reach the teammates, who
       keep a live application pointing at something that no longer exists —
       and that live application then blocks them from joining anywhere else.
       Removing them one by one does reach them: it cancels each application
       and frees them to go elsewhere. So the roster has to be empty first,
       which is the same rule that stops a lead withdrawing from under a team. */
    const roster = await listTeamMembers(evId, code);
    const others = roster.filter(
      (m: any) => String(m?.email ?? "").toLowerCase() !== who.email.toLowerCase(),
    );
    if (others.length > 0)
      return jsonError(
        `${team.name} still has ` +
          (others.length === 1 ? "a teammate" : `${others.length} teammates`) +
          " on it. Remove them first — deleting the team would leave them registered for a team that no longer exists.",
        409,
      );

    await putJson(teamPath(evId, code), { ...team, deletedAt: new Date().toISOString() }, true);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return blobFailed(e, "team delete failed");
  }
}

/**
 * Teams this person already has for OTHER events, so the dialog can offer to
 * carry the name over instead of making them retype it. Only the name travels —
 * a team is per-event, and pulling a roster across would enter people for an
 * event they never agreed to.
 */
async function otherTeams(body: any) {
  const evId = String(body?.eventId ?? "").trim();
  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;

  try {
    const rows = await listAll("team/");
    const records = await Promise.all(rows.map((b) => readPrivate(b.url)));
    const teams = (records.filter(Boolean) as Team[])
      .filter((t) => t && !t.deletedAt && t.eventId && t.eventId !== evId)
      .filter(
        (t) =>
          t.createdByEmail === who.email ||
          (Array.isArray(t.members) && t.members.some((m) => m?.email === who.email))
      )
      .map((t) => ({
        eventId: t.eventId,
        eventName: findEvent(t.eventId)?.name ?? t.eventId,
        code: t.code,
        name: t.name,
        isLead: t.createdByEmail === who.email,
      }))
      .slice(0, 5);
    return NextResponse.json({ teams }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return blobFailed(e, "team others failed");
  }
}

/**
 * The lead adding a teammate themselves.
 *
 * This is the path that replaced "send everyone the code and hope". The lead
 * types a name, email and phone; that person lands on the roster immediately
 * and an invite goes to their mailbox. Because the place is held from this
 * moment, capacity is charged here and not at accept — otherwise a lead could
 * invite twelve people for a team of four and let the race settle it.
 */
async function addMember(body: any) {
  if (!effectiveRegistrationOpen()) return jsonError(registrationUnavailableMessage(), 409);

  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);
  /* An event can close before the fest-wide date (Event.registrationCloses). */
  if (!effectiveRegistrationOpen(undefined, festFor(event))) return jsonError(eventClosedMessage(event), 409);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;

  const code = normalizeTeamCode(String(body?.code ?? ""));
  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);

  const parsed = readAddMember({
    name: body?.memberName,
    email: body?.memberEmail,
    phone: body?.memberPhone,
  });
  if ("error" in parsed) return jsonError(parsed.error, 400);
  const { fields } = parsed;

  try {
    const team = await loadTeam(evId, code);
    if (!team) return jsonError("No team found for that code.", 404);
    if (team.createdByEmail !== who.email)
      return jsonError("Only the team lead can add members.", 403);
    /* Same rule as joining: growing a team that is already in is fine. */
    if (!(await leadIsRegistered(evId, team)) && (await eventIsFull(event)))
      return jsonError(eventFullMessage(event.name), 409);
    if (fields.email === who.email)
      return jsonError("You're already on this team as the lead.", 409);

    const roster = await listTeamMembers(evId, code);
    const decision = canAddMember({
      roster,
      maxMembers: maxTeamSizeFor(event),
      email: fields.email,
    });
    if (!decision.ok) return jsonError(decision.message, 409);

    /* Already spoken for elsewhere in this event. Both records are checked
       because either alone lets somebody end up on two teams: an entrant who
       registered solo has an application and no membership. */
    const [priorCode, priorApp] = await Promise.all([
      liveMembershipCode(evId, fields.email),
      readJsonByPath(applicationPath(evId, fields.email)),
    ]);
    if (priorCode && priorCode !== code)
      return jsonError(`${fields.name} is already on another team for this event.`, 409);
    if (priorApp && isLiveApplication((priorApp as Application).status))
      return jsonError(`${fields.name} has already registered for this event.`, 409);

    /* The lead's own registration carries their name and college. The
       registration dialog has both to hand; My Tickets has neither, and the
       member inherits the college — so it is read from the row the lead
       already filled in rather than asked for a second time. */
    const leadRow = (await readJsonByPath(applicationPath(evId, who.email))) as Application | null;
    const college = String(body?.college ?? "").trim() || String(leadRow?.college ?? "");
    const leadName =
      String(body?.leadName ?? "").trim() || String(leadRow?.name ?? "").trim() || "Your team lead";

    const token = newInviteToken();
    const member = invitedMember({ fields, college, token });
    const pointer: InvitePointer = {
      token,
      eventId: evId,
      code,
      email: fields.email,
      createdAt: member.invitedAt!,
    };

    await putJson(invitePath(token), pointer, false);
    await putJson(teamMemberPath(evId, fields.email), { code, eventId: evId, member }, true);

    /* Best effort. A bounced invite must not undo a member the lead can already
       see on the roster — they still have the link to hand over themselves. */
    const mail = await sendInviteEmail({
      to: fields.email,
      memberName: fields.name,
      leadName,
      teamName: team.name,
      eventName: event.name,
      token,
    });

    const members = await listTeamMembers(evId, code);
    return NextResponse.json(
      {
        team: toTeamPreview(team, members, maxTeamSizeFor(event), true),
        inviteUrl: inviteUrl(token),
        invited: { name: fields.name, email: fields.email },
        emailSent: mail.sent,
        emailError: mail.sent ? null : mail.error ?? null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return jsonError("That invite already exists. Refresh and try again.", 409);
    return blobFailed(e, "team add member failed");
  }
}

/**
 * Taking someone off a roster — the lead removing them, or the member leaving.
 *
 * One function, because the effects are identical and only the permission
 * differs. The store has no delete, so the membership is rewritten with an
 * empty code: listTeamMembers matches on code, so the row stops counting
 * everywhere at once rather than every reader needing to learn a new flag.
 *
 * The lead cannot leave their own team — that is deleting it, which has its own
 * action and its own consequences for everyone else on the roster.
 */
async function removeFromTeam(body: any, mode: "leave" | "remove") {
  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);

  const code = normalizeTeamCode(String(body?.code ?? ""));
  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);

  try {
    const team = await loadTeam(evId, code);
    if (!team) return jsonError("No team found for that code.", 404);

    let target: string;
    if (mode === "remove") {
      const who = await resolveApplicantEmail(String(body?.email ?? ""));
      if ("error" in who) return who.error;
      if (team.createdByEmail !== who.email)
        return jsonError("Only the team lead can remove members.", 403);
      target = normalizeMemberEmail(body?.memberEmail);
      if (!isValidMemberEmail(target)) return jsonError("Pick a member to remove.", 400);
      if (target === team.createdByEmail)
        return jsonError("You're the team lead. Delete the team instead.", 409);
    } else {
      /* Leaving proves itself one of two ways: signed in as that member, or
         holding their invite token. The token is what lets someone leave from
         the email alone, which is the point of a no-sign-in accept. */
      const token = readInviteToken(body?.token);
      if (isValidInviteToken(token)) {
        const pointer = (await readJsonByPath(invitePath(token))) as InvitePointer | null;
        if (!pointer || pointer.eventId !== evId || pointer.code !== code)
          return jsonError("That link is no longer valid.", 404);
        target = normalizeMemberEmail(pointer.email);
      } else {
        const who = await resolveApplicantEmail(String(body?.email ?? ""));
        if ("error" in who) return who.error;
        target = who.email;
      }
      if (target === team.createdByEmail)
        return jsonError("You're the team lead. Delete the team instead.", 409);
    }

    const record = (await readJsonByPath(teamMemberPath(evId, target))) as
      | { code?: string; member?: TeamMember }
      | null;
    if (!record || normalizeTeamCode(record.code ?? "") !== code)
      return jsonError("They're not on this team.", 404);

    const now = new Date().toISOString();
    await putJson(
      teamMemberPath(evId, target),
      { code: "", eventId: evId, member: record.member, removedAt: now },
      true,
    );

    /* Burn the invite link, so someone removed cannot walk back in through the
       email still sitting in their inbox. */
    const spent = record.member?.inviteToken;
    if (spent && isValidInviteToken(spent)) {
      const pointer = (await readJsonByPath(invitePath(spent))) as InvitePointer | null;
      if (pointer) await putJson(invitePath(spent), { ...pointer, usedAt: now }, true);
    }

    /* If they had accepted, they own an application. It stops holding a place
       the moment they stop being on the team. */
    const app = (await readJsonByPath(applicationPath(evId, target))) as Application | null;
    if (app && isLiveApplication(app.status))
      await putJson(
        applicationPath(evId, target),
        { ...app, status: "cancelled", cancelledAt: now },
        true,
      );

    const members = await listTeamMembers(evId, code);
    return NextResponse.json(
      { ok: true, team: toTeamPreview(team, members, maxTeamSizeFor(event), true) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return blobFailed(e, `team ${mode} failed`);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const evId = String(url.searchParams.get("event") ?? url.searchParams.get("eventId") ?? "").trim();
  const mine = url.searchParams.get("mine");
  if (mine === "1" || mine === "true") return mineTeam(evId, "");
  const code = String(url.searchParams.get("code") ?? "");
  /* GET carries no body, so only a signed-in viewer can be recognised here. */
  return verifyTeam(evId, code, "");
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("That request wasn't readable. Refresh and try again.", 400);
  }

  const action = String(body?.action ?? "create").toLowerCase();
  if (action === "verify") {
    const evId = String(body?.eventId ?? body?.event ?? "").trim();
    return verifyTeam(evId, String(body?.code ?? ""), String(body?.email ?? ""));
  }
  if (action === "mine") {
    const evId = String(body?.eventId ?? body?.event ?? "").trim();
    return mineTeam(evId, String(body?.email ?? ""));
  }
  if (action === "join") return joinTeam(body);
  if (action === "add_member") return addMember(body);
  if (action === "remove_member") return removeFromTeam(body, "remove");
  if (action === "leave") return removeFromTeam(body, "leave");
  if (action === "delete") return deleteTeam(body);
  if (action === "others") return otherTeams(body);
  if (action === "create") return createTeam(body);
  return jsonError("Unknown action.", 400);
}
