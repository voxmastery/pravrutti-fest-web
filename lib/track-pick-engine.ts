import { TRACK_CAP, isTrackId, type TrackId } from "@/lib/track-pick";

/**
 * The seat check and the write are one transaction.
 *
 * `TrackPickDb.transaction` must not overlap with another transaction on the
 * same store: MySQL takes `SELECT … FOR UPDATE` on a lock row, and the
 * in-memory store queues the callback. Unique keys are the backstop —
 * one row per team, one seat per track.
 *
 * Claiming the same team and the same track again returns the existing row
 * (double tap, retry, refresh). A different track is refused. Teams cannot
 * change a locked pick; a staff move or undo can.
 */

export class TrackPickConflict extends Error {
  constructor(readonly kind: "duplicate_team" | "duplicate_seat") {
    super(kind);
    this.name = "TrackPickConflict";
  }
}

export type PickRow = {
  eventId: string;
  teamCode: string;
  trackId: TrackId;
  seat: number;
  pickedAt: string;
  pickedBy: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
};

export type PauseState = {
  paused: boolean;
  pausedBy: string | null;
  pausedAt: string | null;
};

export type AuditRow = {
  id: number;
  eventId: string;
  teamCode: string;
  action: "move" | "undo";
  fromTrack: string | null;
  toTrack: string | null;
  fromSeat: number | null;
  toSeat: number | null;
  actorEmail: string;
  actorName: string;
  reason: string;
  at: string;
};

export interface TrackPickTx {
  lock(): Promise<void>;
  readPick(teamCode: string): Promise<PickRow | null>;
  picksForTrack(trackId: string): Promise<PickRow[]>;
  listPicks(): Promise<PickRow[]>;
  insertPick(row: PickRow): Promise<void>;
  updatePick(row: PickRow): Promise<void>;
  deletePick(teamCode: string): Promise<void>;
  readState(): Promise<PauseState>;
  writeState(state: PauseState): Promise<void>;
  insertAudit(row: Omit<AuditRow, "id">): Promise<void>;
  listAudit(): Promise<AuditRow[]>;
}

export interface TrackPickDb {
  transaction<T>(fn: (tx: TrackPickTx) => Promise<T>): Promise<T>;
}

export type ClaimInput = {
  eventId: string;
  now: number;
  opensAt: number;
  trackId: string;
  teamCode: string;
  pickedBy: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
};

export type ClaimResult =
  | { ok: true; idempotent: boolean; pick: PickRow }
  | { ok: false; code: "not_open" | "paused" | "full" | "already_picked" | "bad_track"; pick?: PickRow };

export type StaffActor = { email: string; name: string };

export type OverrideResult =
  | { ok: true; pick: PickRow | null }
  | { ok: false; code: "reason" | "not_picked" | "same_track" | "full" | "bad_track" };

/** Lowest seat number in 1..cap that nobody holds. Null when the track is full. */
export function lowestFreeSeat(taken: readonly number[], cap = TRACK_CAP): number | null {
  const used = new Set(taken);
  for (let seat = 1; seat <= cap; seat++) if (!used.has(seat)) return seat;
  return null;
}

/** A reason an organiser can be held to later. Empty and one-word shrugs are refused. */
export function cleanReason(raw: unknown): string | null {
  const reason = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (reason.length < 3 || reason.length > 500) return null;
  return reason;
}

export async function claimPick(db: TrackPickDb, input: ClaimInput): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    await tx.lock();
    const teamCode = input.teamCode.trim().toUpperCase();
    const existing = await tx.readPick(teamCode);

    if (existing) {
      if (existing.trackId === input.trackId) return { ok: true, idempotent: true, pick: existing };
      return { ok: false, code: "already_picked", pick: existing };
    }

    if (input.now < input.opensAt) return { ok: false, code: "not_open" };

    const state = await tx.readState();
    if (state.paused) return { ok: false, code: "paused" };

    if (!isTrackId(input.trackId)) return { ok: false, code: "bad_track" };

    return place(tx, {
      eventId: input.eventId,
      teamCode,
      trackId: input.trackId,
      pickedAt: new Date(input.now).toISOString(),
      pickedBy: input.pickedBy,
      teamName: input.teamName,
      leadName: input.leadName,
      leadEmail: input.leadEmail,
      leadPhone: input.leadPhone,
    });
  });
}

async function place(tx: TrackPickTx, row: Omit<PickRow, "seat">): Promise<ClaimResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const taken = await tx.picksForTrack(row.trackId);
    if (taken.length >= TRACK_CAP) return { ok: false, code: "full" };
    const seat = lowestFreeSeat(taken.map((p) => p.seat));
    if (seat == null) return { ok: false, code: "full" };
    const next: PickRow = { ...row, seat };
    try {
      await tx.insertPick(next);
      return { ok: true, idempotent: false, pick: next };
    } catch (err) {
      if (!(err instanceof TrackPickConflict)) throw err;
      if (err.kind === "duplicate_team") {
        const again = await tx.readPick(row.teamCode);
        if (again?.trackId === row.trackId) return { ok: true, idempotent: true, pick: again };
        if (again) return { ok: false, code: "already_picked", pick: again };
      }
      /* Seat was taken between the read and the insert. One retry, then full. */
    }
  }
  return { ok: false, code: "full" };
}

export async function setPickingPaused(
  db: TrackPickDb,
  paused: boolean,
  actor: StaffActor,
  nowIso: string,
): Promise<PauseState> {
  return db.transaction(async (tx) => {
    await tx.lock();
    const next: PauseState = paused
      ? { paused: true, pausedBy: actor.email, pausedAt: nowIso }
      : { paused: false, pausedBy: actor.email, pausedAt: nowIso };
    await tx.writeState(next);
    return next;
  });
}

export async function undoPick(
  db: TrackPickDb,
  teamCode: string,
  actor: StaffActor,
  reasonRaw: unknown,
  nowIso: string,
  eventId: string,
): Promise<OverrideResult> {
  const reason = cleanReason(reasonRaw);
  if (!reason) return { ok: false, code: "reason" };
  return db.transaction(async (tx) => {
    await tx.lock();
    const code = teamCode.trim().toUpperCase();
    const existing = await tx.readPick(code);
    if (!existing) return { ok: false, code: "not_picked" };
    await tx.deletePick(code);
    await tx.insertAudit({
      eventId,
      teamCode: code,
      action: "undo",
      fromTrack: existing.trackId,
      toTrack: null,
      fromSeat: existing.seat,
      toSeat: null,
      actorEmail: actor.email,
      actorName: actor.name,
      reason,
      at: nowIso,
    });
    return { ok: true, pick: null };
  });
}

export async function movePick(
  db: TrackPickDb,
  teamCode: string,
  toTrack: string,
  actor: StaffActor,
  reasonRaw: unknown,
  nowIso: string,
  eventId: string,
): Promise<OverrideResult> {
  const reason = cleanReason(reasonRaw);
  if (!reason) return { ok: false, code: "reason" };
  if (!isTrackId(toTrack)) return { ok: false, code: "bad_track" };
  return db.transaction(async (tx) => {
    await tx.lock();
    const code = teamCode.trim().toUpperCase();
    const existing = await tx.readPick(code);
    if (!existing) return { ok: false, code: "not_picked" };
    if (existing.trackId === toTrack) return { ok: false, code: "same_track" };
    const taken = await tx.picksForTrack(toTrack);
    if (taken.length >= TRACK_CAP) return { ok: false, code: "full" };
    const seat = lowestFreeSeat(taken.map((p) => p.seat));
    if (seat == null) return { ok: false, code: "full" };
    const next: PickRow = { ...existing, trackId: toTrack, seat };
    try {
      await tx.updatePick(next);
    } catch (err) {
      if (err instanceof TrackPickConflict) return { ok: false, code: "full" };
      throw err;
    }
    await tx.insertAudit({
      eventId,
      teamCode: code,
      action: "move",
      fromTrack: existing.trackId,
      toTrack,
      fromSeat: existing.seat,
      toSeat: seat,
      actorEmail: actor.email,
      actorName: actor.name,
      reason,
      at: nowIso,
    });
    return { ok: true, pick: next };
  });
}

type Snap = { picks: PickRow[]; state: PauseState; audit: AuditRow[]; nextAuditId: number };

const EMPTY_PAUSE: PauseState = { paused: false, pausedBy: null, pausedAt: null };

export type MemoryPersist = {
  load: () => Promise<Snap | null>;
  save: (snap: Snap) => Promise<void>;
};

/**
 * In-process store used by tests and by local dev when MySQL is not configured.
 * Transactions run one at a time, which is what makes the concurrent cap test
 * meaningful: the awaits inside a claim would otherwise interleave.
 */
export function createMemoryTrackPickDb(persist?: MemoryPersist): TrackPickDb {
  let snap: Snap = { picks: [], state: { ...EMPTY_PAUSE }, audit: [], nextAuditId: 1 };
  let loaded = !persist;
  let chain: Promise<unknown> = Promise.resolve();

  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  return {
    transaction(fn) {
      return exclusive(async () => {
        if (!loaded && persist) {
          const stored = await persist.load();
          if (stored) snap = normalizeSnap(stored);
          loaded = true;
        }
        const draft = structuredClone(snap);
        const result = await fn(memoryTx(draft));
        if (persist) await persist.save(draft);
        snap = draft;
        return result;
      });
    },
  };
}

function normalizeSnap(raw: Snap): Snap {
  return {
    picks: Array.isArray(raw.picks) ? raw.picks : [],
    state: raw.state?.paused ? raw.state : { ...EMPTY_PAUSE, ...raw.state },
    audit: Array.isArray(raw.audit) ? raw.audit : [],
    nextAuditId: Number(raw.nextAuditId) || 1,
  };
}

function memoryTx(draft: Snap): TrackPickTx {
  const sameTeam = (code: string) => (p: PickRow) => p.teamCode === code;
  return {
    async lock() {},
    async readPick(teamCode) {
      const row = draft.picks.find(sameTeam(teamCode.trim().toUpperCase()));
      return row ? { ...row } : null;
    },
    async picksForTrack(trackId) {
      return draft.picks.filter((p) => p.trackId === trackId).map((p) => ({ ...p }));
    },
    async listPicks() {
      return draft.picks.map((p) => ({ ...p }));
    },
    async insertPick(row) {
      const code = row.teamCode.trim().toUpperCase();
      if (draft.picks.some((p) => p.teamCode === code)) throw new TrackPickConflict("duplicate_team");
      if (draft.picks.some((p) => p.trackId === row.trackId && p.seat === row.seat))
        throw new TrackPickConflict("duplicate_seat");
      draft.picks.push({ ...row, teamCode: code });
    },
    async updatePick(row) {
      const code = row.teamCode.trim().toUpperCase();
      const idx = draft.picks.findIndex((p) => p.teamCode === code);
      if (idx < 0) throw new TrackPickConflict("duplicate_team");
      if (draft.picks.some((p) => p.teamCode !== code && p.trackId === row.trackId && p.seat === row.seat))
        throw new TrackPickConflict("duplicate_seat");
      draft.picks[idx] = { ...row, teamCode: code };
    },
    async deletePick(teamCode) {
      const code = teamCode.trim().toUpperCase();
      draft.picks = draft.picks.filter((p) => p.teamCode !== code);
    },
    async readState() {
      return { ...draft.state };
    },
    async writeState(state) {
      draft.state = { ...state };
    },
    async insertAudit(row) {
      draft.audit.push({ ...row, id: draft.nextAuditId++ });
    },
    async listAudit() {
      return [...draft.audit].sort((a, b) => b.id - a.id);
    },
  };
}
