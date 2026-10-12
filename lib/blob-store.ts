import { createHash } from "crypto";
import {
  useDevBlob,
  devListAll,
  devReadJson,
  devPutJson,
  devDeleteJson,
  DEV_URL_PREFIX,
} from "@/lib/dev-blob";
import {
  sqlEnabled,
  sqlListAll,
  sqlReadJson,
  sqlPutJson,
  sqlDeleteJson,
  sqlCasUpdate,
  SQL_URL_PREFIX,
} from "@/lib/sql-store";
import { withKeyLock } from "@/lib/key-lock";
import {
  memEnabled,
  memListAll,
  memReadJson,
  memPutJson,
  memDeleteJson,
  MEM_URL_PREFIX,
} from "@/lib/mem-store";

/**
 * Storage seam. Two backends, tried in this order:
 *
 *   1. dev filesystem  — local work needs no database
 *   2. MySQL           — production on Hostinger
 *   3. in-memory       — the Vercel test site only (no database there)
 *
 * and nothing else: an unconfigured environment throws rather than pretending
 * a write succeeded, because a silently dropped registration is discovered at
 * the registration desk on the morning of the fest.
 *
 * The public API here is the contract that 9 route/lib consumers and 12 test
 * files depend on, so it does not change when the backend does.
 */

const noBackend = (): never => {
  throw new Error(
    "No storage backend configured. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD."
  );
};

export async function listAll(prefix: string) {
  if (useDevBlob()) return devListAll(prefix);
  if (sqlEnabled()) return sqlListAll(prefix);
  if (memEnabled()) return memListAll(prefix);
  return noBackend();
}

/**
 * Resolves a url handed back by listAll. Both backends return an addressable
 * scheme rather than an HTTP url, so nothing here goes over the network — the
 * cache-busting dance the Blob version needed is gone with it.
 */
export async function readPrivate(url: string) {
  if (url.startsWith(DEV_URL_PREFIX)) return devReadJson(url.slice(DEV_URL_PREFIX.length));
  if (url.startsWith(SQL_URL_PREFIX)) return sqlReadJson(url.slice(SQL_URL_PREFIX.length));
  if (url.startsWith(MEM_URL_PREFIX)) return memReadJson(url.slice(MEM_URL_PREFIX.length));
  return null;
}

export function emailScopedKey(eventId: string, email: string) {
  return createHash("sha256").update(`${eventId}:${email.toLowerCase()}`).digest("hex").slice(0, 24);
}

/**
 * Where a payment reference is claimed.
 *
 * Hashed rather than used directly: a reference may contain "/" and would
 * otherwise carve a path. One key per reference is the point — the first
 * registration to claim it wins, and a second is turned away.
 */
export function paymentRefPath(ref: string) {
  const key = createHash("sha256").update(ref.trim().toLowerCase()).digest("hex").slice(0, 24);
  return `payment-ref/${key}.json`;
}

/**
 * One key per person per reminder number. Claimed with overwrite:false
 * before a reminder is sent, so of the two Node processes Hostinger runs —
 * each with its own scheduler — exactly one sends. The count on the row is
 * the throttle; this is the lock.
 */
export function reminderClaimPath(eventId: string, email: string, n: number) {
  return `reminder/${emailScopedKey(eventId, email)}/${n}.json`;
}

export function applicationPath(eventId: string, email: string) {
  return `app/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

/**
 * Fest entry, recorded once per person rather than per registration.
 *
 * Keyed on email alone — the gate asks "has this human come through the
 * door", which is a different question from "did they turn up to Robo Race".
 * Keeping them apart means an organiser admitting someone at the entrance
 * never overwrites, or stands in for, a coordinator's event check-in.
 */
export function gatePath(email: string) {
  return `gate/${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}.json`;
}

export function teamPath(eventId: string, code: string) {
  return `team/${eventId}/${code}.json`;
}

export function teamMemberPath(eventId: string, email: string) {
  return `team-member/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

/**
 * An invite link's token, pointing at the event, team and email it was issued
 * for. Keyed on the token alone so accepting costs a single read: the
 * alternative is scanning every team-member record for a matching token, on a
 * page any stranger can open from an email.
 */
export function invitePath(token: string) {
  return `invite/${token}.json`;
}

export async function readJsonByPath(path: string) {
  if (useDevBlob()) return devReadJson(path);
  if (sqlEnabled()) return sqlReadJson(path);
  if (memEnabled()) return memReadJson(path);
  return noBackend();
}

/**
 * `overwrite: false` throws when the key already exists. That is the
 * duplicate-registration guard — register and teams both catch the throw to
 * mean "this person has already applied" — so it is enforced by the database
 * rather than by a read-then-write that two simultaneous applicants could
 * both pass.
 */
export async function putJson(path: string, data: unknown, overwrite: boolean) {
  if (useDevBlob()) return devPutJson(path, data);
  if (sqlEnabled()) {
    await sqlPutJson(path, data, overwrite);
    await noteAppIndex(path, data);
    return;
  }
  if (memEnabled()) return memPutJson(path, data, overwrite);
  return noBackend();
}

export type CasDecision<T> = { write: boolean; next: T | null };
export type CasResult<T> = { current: T | null; written: boolean; next: T | null };

/**
 * Apply a check-in only if the row still matches what the decision saw.
 * On MySQL that is a row lock. On the dev and memory stores it is an
 * in-process queue, which is all those backends have.
 */
export async function casUpdate<T>(
  path: string,
  decide: (current: T | null) => CasDecision<T> | Promise<CasDecision<T>>
): Promise<CasResult<T>> {
  if (useDevBlob()) {
    return withKeyLock(path, async () => {
      const current = (await devReadJson(path)) as T | null;
      const decision = await decide(current);
      if (!decision.write || decision.next == null) return { current, written: false, next: current };
      await devPutJson(path, decision.next);
      return { current, written: true, next: decision.next };
    });
  }
  if (sqlEnabled()) {
    const result = await sqlCasUpdate(path, decide);
    if (result.written) await noteAppIndex(path, result.next);
    return result;
  }
  if (memEnabled()) {
    return withKeyLock(path, async () => {
      const current = (await memReadJson(path)) as T | null;
      const decision = await decide(current);
      if (!decision.write || decision.next == null) return { current, written: false, next: current };
      await memPutJson(path, decision.next, true);
      return { current, written: true, next: decision.next };
    });
  }
  return noBackend();
}

/** The index is an accelerator. A failure here must not fail the kv write. */
async function noteAppIndex(path: string, data: unknown) {
  if (!path.startsWith("app/")) return;
  try {
    const { syncAppIndex } = await import("@/lib/app-index");
    await syncAppIndex(path, data);
  } catch {
    /* The next lookup falls back to a single JSON scan. */
  }
}

/**
 * Permanently removes one record. The store had no delete on purpose — nothing
 * in the registration flow should ever lose data — so this has exactly one
 * caller: the organiser's test-data removal, which saves a copy of every
 * record before deleting it (lib/purge.ts).
 */
export async function deleteJson(path: string) {
  if (useDevBlob()) return devDeleteJson(path);
  if (sqlEnabled()) {
    await sqlDeleteJson(path);
    try {
      const { removeAppIndex } = await import("@/lib/app-index");
      await removeAppIndex(path);
    } catch {
      /* The kv row is already gone. A stale index row misses on the next read. */
    }
    return;
  }
  if (memEnabled()) return memDeleteJson(path);
  return noBackend();
}

/**
 * Roster derived from per-member records rather than a team's own `members[]`.
 *
 * Each member owns one record keyed by their email, so simultaneous joins
 * touch different keys and cannot clobber one another — originally a
 * workaround for Blob having no compare-and-swap, kept because it is the
 * right shape regardless of backend.
 */
export async function listTeamMembers(eventId: string, code: string) {
  const rows = await listAll(`team-member/${eventId}/`);
  const records = await Promise.all(rows.map((b) => readPrivate(b.url)));
  return records
    .filter((r: any) => r && r.code === code && r.member)
    .map((r: any) => r.member)
    .sort((a: any, b: any) => String(a.joinedAt).localeCompare(String(b.joinedAt)));
}
