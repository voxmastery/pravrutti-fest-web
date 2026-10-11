import "server-only";
import { HACKTIVATE_EVENT_ID } from "@/lib/track-pick";
import {
  TrackPickConflict,
  createMemoryTrackPickDb,
  type AuditRow,
  type PauseState,
  type PickRow,
  type TrackPickDb,
  type TrackPickTx,
} from "@/lib/track-pick-engine";
import { useDevBlob, devReadJson, devPutJson } from "@/lib/dev-blob";
import { sqlEnabled, sqlQuery, sqlWithTransaction, type SqlTxConn } from "@/lib/sql-store";

/**
 * Production (Hostinger) keeps picks in MySQL so two Node processes cannot
 * both hand out the last seat. Tables are created on first use — the kv
 * migration script does not re-run against the live database.
 *
 * Tests and `next dev` without MySQL use an in-memory store. Dev also writes
 * a copy under `.dev-blob` so a reload does not forget a rehearsal.
 */

export const TRACK_PICKS_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS track_picks (
     event_id VARCHAR(80) NOT NULL,
     team_code VARCHAR(32) NOT NULL,
     track_id VARCHAR(8) NOT NULL,
     seat_no INT NOT NULL,
     picked_at VARCHAR(40) NOT NULL,
     picked_by VARCHAR(191) NOT NULL,
     team_name VARCHAR(191) NOT NULL,
     lead_name VARCHAR(191) NOT NULL,
     lead_email VARCHAR(191) NOT NULL,
     lead_phone VARCHAR(32) NOT NULL,
     PRIMARY KEY (event_id, team_code),
     UNIQUE KEY track_seat (event_id, track_id, seat_no),
     KEY track_lookup (event_id, track_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const TRACK_PICK_STATE_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS track_pick_state (
     event_id VARCHAR(80) NOT NULL PRIMARY KEY,
     paused TINYINT(1) NOT NULL DEFAULT 0,
     paused_by VARCHAR(191) NULL,
     paused_at VARCHAR(40) NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const TRACK_PICK_AUDIT_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS track_pick_audit (
     id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     event_id VARCHAR(80) NOT NULL,
     team_code VARCHAR(32) NOT NULL,
     action VARCHAR(16) NOT NULL,
     from_track VARCHAR(8) NULL,
     to_track VARCHAR(8) NULL,
     from_seat INT NULL,
     to_seat INT NULL,
     actor_email VARCHAR(191) NOT NULL,
     actor_name VARCHAR(191) NOT NULL,
     reason VARCHAR(500) NOT NULL,
     at VARCHAR(40) NOT NULL,
     KEY event_at (event_id, id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const TRACK_PICK_LOCK_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS track_pick_lock (
     event_id VARCHAR(80) NOT NULL PRIMARY KEY
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const TRACK_PICK_LOCK_SQL =
  `SELECT event_id FROM track_pick_lock WHERE event_id = ? FOR UPDATE`;

const DEV_SNAPSHOT = "track-pick/hacktivate.json";

let ensuring: Promise<void> | null = null;

export function ensureTrackPickTables(): Promise<void> {
  if (!sqlEnabled()) return Promise.resolve();
  if (!ensuring) {
    ensuring = (async () => {
      await sqlQuery(TRACK_PICKS_TABLE_SQL);
      await sqlQuery(TRACK_PICK_STATE_TABLE_SQL);
      await sqlQuery(TRACK_PICK_AUDIT_TABLE_SQL);
      await sqlQuery(TRACK_PICK_LOCK_TABLE_SQL);
      const { sqlExecute } = await import("@/lib/sql-store");
      await sqlExecute(`INSERT IGNORE INTO track_pick_lock (event_id) VALUES (?)`, [HACKTIVATE_EVENT_ID]);
    })().catch((err) => {
      ensuring = null;
      throw err;
    });
  }
  return ensuring;
}

function isDup(err: unknown): boolean {
  const e = err as { code?: string; errno?: number };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062;
}

function asConflict(err: unknown): TrackPickConflict {
  const msg = String((err as { message?: string })?.message ?? "");
  return new TrackPickConflict(msg.includes("track_seat") ? "duplicate_seat" : "duplicate_team");
}

function toPick(r: Record<string, unknown>): PickRow {
  return {
    eventId: String(r.event_id),
    teamCode: String(r.team_code),
    trackId: String(r.track_id) as PickRow["trackId"],
    seat: Number(r.seat_no),
    pickedAt: String(r.picked_at),
    pickedBy: String(r.picked_by),
    teamName: String(r.team_name),
    leadName: String(r.lead_name),
    leadEmail: String(r.lead_email),
    leadPhone: String(r.lead_phone ?? ""),
  };
}

function sqlTx(conn: SqlTxConn, eventId: string): TrackPickTx {
  return {
    async lock() {
      await conn.execute(TRACK_PICK_LOCK_SQL, [eventId]);
    },
    async readPick(teamCode) {
      const [rows] = await conn.execute(
        `SELECT * FROM track_picks WHERE event_id = ? AND team_code = ?`,
        [eventId, teamCode.trim().toUpperCase()],
      );
      const row = (rows as Record<string, unknown>[])[0];
      return row ? toPick(row) : null;
    },
    async picksForTrack(trackId) {
      const [rows] = await conn.execute(
        `SELECT * FROM track_picks WHERE event_id = ? AND track_id = ?`,
        [eventId, trackId],
      );
      return (rows as Record<string, unknown>[]).map(toPick);
    },
    async listPicks() {
      const [rows] = await conn.execute(`SELECT * FROM track_picks WHERE event_id = ?`, [eventId]);
      return (rows as Record<string, unknown>[]).map(toPick);
    },
    async insertPick(row) {
      try {
        await conn.execute(
          `INSERT INTO track_picks
             (event_id, team_code, track_id, seat_no, picked_at, picked_by, team_name, lead_name, lead_email, lead_phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            row.teamCode.trim().toUpperCase(),
            row.trackId,
            row.seat,
            row.pickedAt,
            row.pickedBy,
            row.teamName,
            row.leadName,
            row.leadEmail,
            row.leadPhone,
          ],
        );
      } catch (err) {
        if (isDup(err)) throw asConflict(err);
        throw err;
      }
    },
    async updatePick(row) {
      try {
        await conn.execute(
          `UPDATE track_picks
              SET track_id = ?, seat_no = ?, team_name = ?, lead_name = ?, lead_email = ?, lead_phone = ?
            WHERE event_id = ? AND team_code = ?`,
          [
            row.trackId,
            row.seat,
            row.teamName,
            row.leadName,
            row.leadEmail,
            row.leadPhone,
            eventId,
            row.teamCode.trim().toUpperCase(),
          ],
        );
      } catch (err) {
        if (isDup(err)) throw asConflict(err);
        throw err;
      }
    },
    async deletePick(teamCode) {
      await conn.execute(`DELETE FROM track_picks WHERE event_id = ? AND team_code = ?`, [
        eventId,
        teamCode.trim().toUpperCase(),
      ]);
    },
    async readState() {
      const [rows] = await conn.execute(
        `SELECT paused, paused_by, paused_at FROM track_pick_state WHERE event_id = ?`,
        [eventId],
      );
      const row = (rows as { paused: number | boolean; paused_by: string | null; paused_at: string | null }[])[0];
      if (!row) return { paused: false, pausedBy: null, pausedAt: null };
      return {
        paused: Number(row.paused) === 1 || row.paused === true,
        pausedBy: row.paused_by,
        pausedAt: row.paused_at,
      };
    },
    async writeState(state: PauseState) {
      await conn.execute(
        `INSERT INTO track_pick_state (event_id, paused, paused_by, paused_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE paused = VALUES(paused), paused_by = VALUES(paused_by), paused_at = VALUES(paused_at)`,
        [eventId, state.paused ? 1 : 0, state.pausedBy, state.pausedAt],
      );
    },
    async insertAudit(row) {
      await conn.execute(
        `INSERT INTO track_pick_audit
           (event_id, team_code, action, from_track, to_track, from_seat, to_seat, actor_email, actor_name, reason, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          row.teamCode,
          row.action,
          row.fromTrack,
          row.toTrack,
          row.fromSeat,
          row.toSeat,
          row.actorEmail,
          row.actorName,
          row.reason,
          row.at,
        ],
      );
    },
    async listAudit() {
      const [rows] = await conn.execute(
        `SELECT id, event_id, team_code, action, from_track, to_track, from_seat, to_seat,
                actor_email, actor_name, reason, at
           FROM track_pick_audit WHERE event_id = ? ORDER BY id DESC LIMIT 200`,
        [eventId],
      );
      return (rows as Record<string, unknown>[]).map(
        (r): AuditRow => ({
          id: Number(r.id),
          eventId: String(r.event_id),
          teamCode: String(r.team_code),
          action: r.action === "undo" ? "undo" : "move",
          fromTrack: r.from_track == null ? null : String(r.from_track),
          toTrack: r.to_track == null ? null : String(r.to_track),
          fromSeat: r.from_seat == null ? null : Number(r.from_seat),
          toSeat: r.to_seat == null ? null : Number(r.to_seat),
          actorEmail: String(r.actor_email),
          actorName: String(r.actor_name),
          reason: String(r.reason),
          at: String(r.at),
        }),
      );
    },
  };
}

export function createSqlTrackPickDb(eventId = HACKTIVATE_EVENT_ID): TrackPickDb {
  return {
    async transaction(fn) {
      await ensureTrackPickTables();
      return sqlWithTransaction((conn) => fn(sqlTx(conn, eventId)));
    },
  };
}

let singleton: TrackPickDb | null = null;

export function resetTrackPickDbForTests() {
  singleton = null;
}

export function getTrackPickDb(): TrackPickDb {
  if (singleton) return singleton;
  if (sqlEnabled()) {
    singleton = createSqlTrackPickDb();
    return singleton;
  }
  const persist =
    process.env.NODE_ENV !== "test" && useDevBlob()
      ? {
          load: async () => devReadJson(DEV_SNAPSHOT),
          save: async (snap: unknown) => {
            await devPutJson(DEV_SNAPSHOT, snap);
          },
        }
      : undefined;
  singleton = createMemoryTrackPickDb(persist);
  return singleton;
}
