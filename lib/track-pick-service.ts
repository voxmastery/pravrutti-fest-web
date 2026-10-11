import "server-only";
import type { Application } from "@/lib/applications";
import {
  applicationPath,
  listAll,
  readJsonByPath,
  readPrivate,
  teamMemberPath,
  teamPath,
} from "@/lib/blob-store";
import { resolveDisplayName, resolveEmail } from "@/lib/identity";
import type { Team } from "@/lib/teams";
import {
  COPY,
  HACKTIVATE_EVENT_ID,
  TRACKS,
  TRACK_CAP,
  fullTrackMessage,
  gate,
  knownStaffName,
  trackById,
  trackPickOpensAt,
  type BoardRow,
  type GateDecision,
  type ParticipantState,
  type PublicPick,
  type PublicTrack,
  type StaffBoard,
  type TeamStanding,
  type TrackCount,
  type ViewerFacts,
} from "@/lib/track-pick";
import { getTrackPickDb } from "@/lib/track-pick-db";
import {
  claimPick,
  lowestFreeSeat,
  movePick,
  setPickingPaused,
  undoPick,
  type ClaimResult,
  type OverrideResult,
  type PauseState,
  type PickRow,
  type StaffActor,
  type TrackPickDb,
} from "@/lib/track-pick-engine";

export type TrackPickDeps = {
  now?: number;
  opensAt?: number;
  db?: TrackPickDb;
};

function depsOf(deps?: TrackPickDeps) {
  return {
    now: deps?.now ?? Date.now(),
    opensAt: deps?.opensAt ?? trackPickOpensAt(),
    db: deps?.db ?? getTrackPickDb(),
  };
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

function standing(app: Application | null): TeamStanding | "other" {
  if (!app || app.movedTo) return "other";
  if (app.status === "confirmed") return "confirmed";
  if (app.status === "pending") return "in_review";
  return "closed";
}

function viewerLive(app: Application | null): boolean {
  if (!app || app.movedTo) return false;
  return app.status === "confirmed" || app.status === "pending";
}

export async function loadViewerFacts(email: string): Promise<ViewerFacts> {
  const who = norm(email);
  const ownApp = (await readJsonByPath(applicationPath(HACKTIVATE_EVENT_ID, who))) as Application | null;
  const memberRow = (await readJsonByPath(teamMemberPath(HACKTIVATE_EVENT_ID, who))) as { code?: string } | null;
  const code = String(memberRow?.code ?? ownApp?.teamCode ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { email: who, team: null, isLead: false, viewerLive: false };

  const team = (await readJsonByPath(teamPath(HACKTIVATE_EVENT_ID, code))) as Team | null;
  if (!team || team.deletedAt || team.movedTo || norm(team.eventId) !== HACKTIVATE_EVENT_ID) {
    return { email: who, team: null, isLead: false, viewerLive: false };
  }

  const leadEmail = norm(team.createdByEmail);
  const leadApp =
    leadEmail === who
      ? ownApp
      : ((await readJsonByPath(applicationPath(HACKTIVATE_EVENT_ID, leadEmail))) as Application | null);
  const live = viewerLive(ownApp);
  const status = standing(leadApp);
  return {
    email: who,
    isLead: live && who === leadEmail && status === "confirmed",
    viewerLive: live,
    team: {
      code: team.code,
      name: team.name,
      leadEmail,
      leadName: String(leadApp?.name ?? "").trim() || leadEmail,
      status: status === "other" ? "closed" : status,
    },
  };
}

async function readBoardBits(db: TrackPickDb) {
  return db.transaction(async (tx) => ({
    picks: await tx.listPicks(),
    state: await tx.readState(),
    audit: await tx.listAudit(),
  }));
}

function publicTracks(picks: PickRow[]): PublicTrack[] {
  return TRACKS.map((track) => {
    const mine = picks.filter((p) => p.trackId === track.id);
    const picked = mine.length;
    return {
      ...track,
      picked,
      left: Math.max(0, TRACK_CAP - picked),
      full: picked >= TRACK_CAP,
      nextSeat: lowestFreeSeat(mine.map((p) => p.seat)),
    };
  });
}

function publicPick(row: PickRow | null): PublicPick | null {
  if (!row) return null;
  const track = trackById(row.trackId);
  return {
    trackId: row.trackId,
    seat: row.seat,
    pickedAt: row.pickedAt,
    trackTitle: track?.title ?? row.trackId,
    trackName: track ? `${track.title}${track.theme ? `: ${track.theme}` : ""}` : row.trackId,
  };
}

export async function getParticipantState(email: string, deps?: TrackPickDeps): Promise<ParticipantState> {
  const { now, opensAt, db } = depsOf(deps);
  const [facts, bits] = await Promise.all([loadViewerFacts(email), readBoardBits(db)]);
  const own = bits.picks.find((p) => facts.team && p.teamCode === facts.team.code) ?? null;
  const decision: GateDecision = gate({
    facts,
    now,
    opensAt,
    paused: bits.state.paused,
    picked: !!own,
  });
  return {
    screen: decision.screen,
    canPick: decision.canPick,
    message: decision.message,
    paused: bits.state.paused,
    open: now >= opensAt,
    opensAt: new Date(opensAt).toISOString(),
    serverNow: new Date(now).toISOString(),
    viewer: { email: facts.email, isLead: facts.isLead },
    team: facts.team,
    tracks: publicTracks(bits.picks),
    pick: publicPick(own),
  };
}

export type ClaimResponse =
  | { ok: true; idempotent: boolean; state: ParticipantState }
  | { ok: false; status: number; code: string; message: string; state: ParticipantState };

export async function claimTrack(email: string, trackId: string, deps?: TrackPickDeps): Promise<ClaimResponse> {
  const { now, opensAt, db } = depsOf(deps);
  const facts = await loadViewerFacts(email);
  const bits = await readBoardBits(db);
  const own = bits.picks.find((p) => facts.team && p.teamCode === facts.team.code) ?? null;
  const decision = gate({ facts, now, opensAt, paused: bits.state.paused, picked: !!own });

  const state = () => getParticipantState(email, { now, opensAt, db });

  if (!decision.canPick) {
    /* A retry of the track they already hold is success, not an error. */
    if (decision.screen === "locked" && own && own.trackId === trackId) {
      return { ok: true, idempotent: true, state: await state() };
    }
    if (decision.screen === "locked" && own && own.trackId !== trackId) {
      return {
        ok: false,
        status: 409,
        code: "already_picked",
        message: COPY.alreadyPicked,
        state: await state(),
      };
    }
    const status = 403;
    return {
      ok: false,
      status,
      code: decision.screen,
      message: decision.message ?? COPY.notLead,
      state: await state(),
    };
  }

  const leadApp = (await readJsonByPath(applicationPath(HACKTIVATE_EVENT_ID, facts.email))) as Application | null;
  const result: ClaimResult = await claimPick(db, {
    eventId: HACKTIVATE_EVENT_ID,
    now,
    opensAt,
    trackId,
    teamCode: facts.team!.code,
    pickedBy: facts.email,
    teamName: facts.team!.name,
    leadName: facts.team!.leadName,
    leadEmail: facts.email,
    leadPhone: String(leadApp?.phone ?? ""),
  });

  const after = await state();
  if (result.ok) return { ok: true, idempotent: result.idempotent, state: after };
  if (result.code === "full") {
    return { ok: false, status: 409, code: "full", message: fullTrackMessage(trackId), state: after };
  }
  if (result.code === "already_picked") {
    return { ok: false, status: 409, code: "already_picked", message: COPY.alreadyPicked, state: after };
  }
  if (result.code === "not_open") {
    return { ok: false, status: 403, code: "not_open", message: COPY.notOpen, state: after };
  }
  if (result.code === "paused") {
    return { ok: false, status: 403, code: "paused", message: COPY.paused, state: after };
  }
  return { ok: false, status: 400, code: "bad_track", message: "That track is not on the list.", state: after };
}

async function loadApplications(): Promise<Application[]> {
  const blobs = await listAll(`app/${HACKTIVATE_EVENT_ID}/`);
  const rows = await Promise.all(blobs.map((b) => readPrivate(b.url)));
  return rows.filter((r): r is Application => !!r && typeof r === "object" && "email" in (r as object));
}

async function loadTeams(): Promise<Team[]> {
  const blobs = await listAll(`team/${HACKTIVATE_EVENT_ID}/`);
  const rows = await Promise.all(blobs.map((b) => readPrivate(b.url)));
  return rows.filter((r): r is Team => !!r && typeof r === "object" && "code" in (r as object) && !(r as Team).deletedAt);
}

export async function getStaffBoard(deps?: TrackPickDeps): Promise<StaffBoard> {
  const { now, db } = depsOf(deps);
  const [teams, apps, bits] = await Promise.all([loadTeams(), loadApplications(), readBoardBits(db)]);
  const appByEmail = new Map(apps.map((a) => [norm(a.email), a]));
  const pickByCode = new Map(bits.picks.map((p) => [p.teamCode.trim().toUpperCase(), p]));

  const rows: BoardRow[] = [];
  const seen = new Set<string>();
  for (const team of teams) {
    if (team.movedTo) continue;
    const code = String(team.code ?? "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const leadEmail = norm(team.createdByEmail);
    const lead = appByEmail.get(leadEmail) ?? null;
    const pick = pickByCode.get(code) ?? null;
    const status = standing(lead);
    rows.push({
      teamCode: code,
      teamName: team.name || pick?.teamName || code,
      leadName: String(lead?.name ?? pick?.leadName ?? "").trim() || leadEmail,
      leadEmail,
      leadPhone: String(lead?.phone ?? pick?.leadPhone ?? ""),
      status,
      trackId: pick?.trackId ?? null,
      seat: pick?.seat ?? null,
      pickedAt: pick?.pickedAt ?? null,
    });
  }
  for (const pick of bits.picks) {
    const code = pick.teamCode.trim().toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    rows.push({
      teamCode: code,
      teamName: pick.teamName,
      leadName: pick.leadName,
      leadEmail: pick.leadEmail,
      leadPhone: pick.leadPhone,
      status: "confirmed",
      trackId: pick.trackId,
      seat: pick.seat,
      pickedAt: pick.pickedAt,
    });
  }

  const confirmed = rows.filter((r) => r.status === "confirmed");
  const pickedTeams = confirmed.filter((r) => r.trackId).length;
  const counts: TrackCount[] = TRACKS.map((track) => {
    const mine = bits.picks.filter((p) => p.trackId === track.id);
    const full = mine.length >= TRACK_CAP;
    const fullAt = full ? mine.map((p) => p.pickedAt).sort().at(-1) ?? null : null;
    return {
      id: track.id,
      title: track.title,
      picked: mine.length,
      left: Math.max(0, TRACK_CAP - mine.length),
      full,
      fullAt,
    };
  });

  return {
    paused: bits.state.paused,
    pausedBy: bits.state.pausedBy,
    pausedAt: bits.state.pausedAt,
    counts,
    confirmedTeams: confirmed.length,
    pickedTeams,
    notPicked: confirmed.length - pickedTeams,
    inReview: rows.filter((r) => r.status === "in_review").length,
    rows,
    audit: bits.audit,
    serverNow: new Date(now).toISOString(),
  };
}

export async function actorFor(email: string): Promise<StaffActor> {
  const known = knownStaffName(email);
  if (known) return { email: norm(email), name: known };
  const [sessionEmail, sessionName] = await Promise.all([resolveEmail(), resolveDisplayName()]);
  if (sessionName && norm(sessionEmail) === norm(email)) return { email: norm(email), name: sessionName };
  const app = (await readJsonByPath(applicationPath(HACKTIVATE_EVENT_ID, norm(email)))) as Application | null;
  const fromApp = String(app?.name ?? "").trim();
  if (fromApp) return { email: norm(email), name: fromApp };
  const local = norm(email).split("@")[0] ?? norm(email);
  return { email: norm(email), name: local };
}

export async function pausePicking(actor: StaffActor, paused: boolean, deps?: TrackPickDeps): Promise<PauseState> {
  const { now, db } = depsOf(deps);
  return setPickingPaused(db, paused, actor, new Date(now).toISOString());
}

export async function staffUndo(
  actor: StaffActor,
  teamCode: string,
  reason: unknown,
  deps?: TrackPickDeps,
): Promise<OverrideResult> {
  const { now, db } = depsOf(deps);
  return undoPick(db, teamCode, actor, reason, new Date(now).toISOString(), HACKTIVATE_EVENT_ID);
}

export async function staffMove(
  actor: StaffActor,
  teamCode: string,
  trackId: string,
  reason: unknown,
  deps?: TrackPickDeps,
): Promise<OverrideResult> {
  const { now, db } = depsOf(deps);
  return movePick(db, teamCode, trackId, actor, reason, new Date(now).toISOString(), HACKTIVATE_EVENT_ID);
}
