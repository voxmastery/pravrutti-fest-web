import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { events, eventId, capacityFor, registrationOpen } from "@/lib/pravrutti-data";
import {
  Application,
  PAYMENTS_LIVE,
  MAX_TEAM_SIZE,
  formatFee,
  isValidPhone,
  normalizePhone,
} from "@/lib/applications";
import {
  Team,
  TeamMember,
  TEAM_CODE_LENGTH,
  MAX_TEAM_BIO,
  normalizeTeamCode,
  isValidTeamCode,
  toTeamPreview,
} from "@/lib/teams";
import { resolveEmail, authRequired } from "@/lib/identity";
import {
  listAll,
  applicationPath,
  teamPath,
  teamMemberPath,
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
  if (!Array.isArray(team.members)) team.members = [];
  return team;
}

function blobFailed(e: unknown, label: string) {
  console.error(label, e);
  return jsonError("Couldn't reach team storage. Try again in a moment.", 500);
}

async function previewResponse(team: Team) {
  const members = await listTeamMembers(team.eventId, team.code);
  return NextResponse.json(toTeamPreview(team, members), { headers: { "cache-control": "no-store" } });
}

async function verifyTeam(evId: string, rawCode: string) {
  const code = normalizeTeamCode(rawCode);
  if (!evId || !findEvent(evId)) return jsonError("That event doesn't exist.", 400);
  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);
  try {
    const team = await loadTeam(evId, code);
    if (!team) return jsonError("No team found for that code.", 404);
    return await previewResponse(team);
  } catch (e) {
    return blobFailed(e, "team verify failed");
  }
}

/** Restore the caller's existing team for this event — code never regenerates. */
async function mineTeam(evId: string, bodyEmail: string) {
  if (!evId || !findEvent(evId)) return jsonError("That event doesn't exist.", 400);
  const who = await resolveApplicantEmail(bodyEmail);
  if ("error" in who) return who.error;
  try {
    const membership = (await readJsonByPath(teamMemberPath(evId, who.email))) as { code?: string } | null;
    const code = normalizeTeamCode(membership?.code ?? "");
    if (!isValidTeamCode(code)) return NextResponse.json({ team: null }, { headers: { "cache-control": "no-store" } });
    const team = await loadTeam(evId, code);
    if (!team) return NextResponse.json({ team: null }, { headers: { "cache-control": "no-store" } });
    return NextResponse.json({ team: toTeamPreview(team) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return blobFailed(e, "team mine failed");
  }
}

function ticketId() {
  return `PRV-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function personApplication(args: {
  event: (typeof events)[number];
  evId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  team: Team;
}): Application {
  const isFree = args.event.fee.toLowerCase().startsWith("free");
  return {
    ticketId: ticketId(),
    eventId: args.evId,
    eventName: args.event.name,
    status: "pending",
    payment: isFree ? "not_required" : PAYMENTS_LIVE ? "paid" : "awaiting",
    fee: isFree ? args.event.fee : formatFee(1),
    name: args.name,
    email: args.email,
    phone: args.phone,
    college: args.college,
    teamName: args.team.name,
    teamCode: args.team.code,
    members: null,
    appliedAt: new Date().toISOString(),
  };
}

async function createTeam(body: any) {
  if (!registrationOpen()) return jsonError("Applications closed on 4 October 2026.", 409);

  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;
  const email = who.email;

  const name = String(body?.name ?? "").trim();
  const bio = String(body?.bio ?? "").trim();
  const leadName = String(body?.leadName ?? "").trim();
  const phone = normalizePhone(body?.phone);
  const college = String(body?.college ?? "").trim();

  if (name.length < 2 || name.length > 80) return jsonError("Enter a team name.", 400);
  if (bio.length > MAX_TEAM_BIO) return jsonError("Team bio is too long.", 400);
  if (leadName.length < 2 || leadName.length > 80) return jsonError("Enter your full name.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a 10-digit phone number.", 400);
  if (college.length < 2 || college.length > 120) return jsonError("Enter your college name.", 400);

  try {
    const existingApp = await readJsonByPath(applicationPath(evId, email));
    if (existingApp) return jsonError("You've already applied for this event.", 409);

    const existingMembership = await readJsonByPath(teamMemberPath(evId, email));
    if (existingMembership?.code) {
      const code = normalizeTeamCode(existingMembership.code);
      const existing = await loadTeam(evId, code);
      if (existing) return NextResponse.json({ ...toTeamPreview(existing), created: false, restored: true });
      return jsonError("You're already on a team for this event.", 409);
    }
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
    await putJson(teamMemberPath(evId, email), { code: team.code, eventId: evId, member: lead }, false);
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return jsonError("You're already on a team for this event.", 409);
    console.error("team membership put failed", e);
    return jsonError("Your team didn't save. Try again in a moment.", 500);
  }

  return NextResponse.json({ ...toTeamPreview(team, [lead]), created: true });
}

async function joinTeam(body: any) {
  if (!registrationOpen()) return jsonError("Applications closed on 4 October 2026.", 409);

  const evId = String(body?.eventId ?? "").trim();
  const event = findEvent(evId);
  if (!event) return jsonError("That event doesn't exist.", 400);

  const who = await resolveApplicantEmail(String(body?.email ?? ""));
  if ("error" in who) return who.error;
  const email = who.email;

  const code = normalizeTeamCode(String(body?.code ?? ""));
  const name = String(body?.name ?? "").trim();
  const phone = normalizePhone(body?.phone);
  const college = String(body?.college ?? "").trim();

  if (!isValidTeamCode(code)) return jsonError("Enter a valid team code.", 400);
  if (name.length < 2 || name.length > 80) return jsonError("Enter your full name.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a 10-digit phone number.", 400);
  if (college.length < 2 || college.length > 120) return jsonError("Enter your college name.", 400);

  let team: Team;
  try {
    const existingApp = await readJsonByPath(applicationPath(evId, email));
    if (existingApp)
      return jsonError("You've already applied for this event.", 409);

    const existingMembership = await readJsonByPath(teamMemberPath(evId, email));
    const prior = normalizeTeamCode(existingMembership?.code ?? "");
    if (prior && prior !== code)
      return jsonError("You're already on a different team for this event.", 409);

    const found = await loadTeam(evId, code);
    if (!found) return jsonError("No team found for that code.", 404);
    team = found;
  } catch (e) {
    return blobFailed(e, "team join precheck failed");
  }

  // Roster comes from per-member records; the team blob's members[] is a cache
  // that concurrent joins can leave stale.
  const roster = await listTeamMembers(evId, code);
  const alreadyMember = roster.some((m: any) => m.email === email);
  if (alreadyMember && team.createdByEmail === email)
    return jsonError("You're the team lead — continue to submit your application.", 409);

  if (!alreadyMember && roster.length >= MAX_TEAM_SIZE)
    return jsonError(`This team is full (${MAX_TEAM_SIZE} including the lead).`, 409);

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

  const record = personApplication({ event, evId, name, email, phone, college, team });
  try {
    await putJson(applicationPath(evId, email), record, false);
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return jsonError("You've already applied for this event.", 409);
    console.error("application put failed", e);
    return jsonError("Your application didn't save. Try again in a moment.", 500);
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
    memberCount: team.members.length,
    maxMembers: MAX_TEAM_SIZE,
  });
}

/**
 * GET  /api/teams?event=&code=          -> team preview (name, bio, member count)
 * GET  /api/teams?event=&mine=1         -> caller's existing team (auth), or { team: null }
 * POST /api/teams { action: "verify" }  -> same preview
 * POST /api/teams { action: "mine" }    -> same as GET mine
 * POST /api/teams { action: "create" }  -> mint a code (auth required); restores if already created
 * POST /api/teams { action: "join" }    -> add member + create their application
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const evId = String(url.searchParams.get("event") ?? url.searchParams.get("eventId") ?? "").trim();
  const mine = url.searchParams.get("mine");
  if (mine === "1" || mine === "true") return mineTeam(evId, "");
  const code = String(url.searchParams.get("code") ?? "");
  return verifyTeam(evId, code);
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
    return verifyTeam(evId, String(body?.code ?? ""));
  }
  if (action === "mine") {
    const evId = String(body?.eventId ?? body?.event ?? "").trim();
    return mineTeam(evId, String(body?.email ?? ""));
  }
  if (action === "join") return joinTeam(body);
  if (action === "create") return createTeam(body);
  return jsonError("Unknown action.", 400);
}
