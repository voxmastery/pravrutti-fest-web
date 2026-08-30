import { list, put } from "@vercel/blob";
import { createHash } from "crypto";

export async function listAll(prefix: string) {
  const out: { pathname: string; url: string }[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: Awaited<ReturnType<typeof list>> = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) out.push({ pathname: b.pathname, url: b.url });
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

export async function readPrivate(url: string) {
  // Overwritten blobs can be served stale from the edge nearest the function,
  // so every read is cache-busted — a decision must never act on old state.
  const fresh = `${url}${url.includes("?") ? "&" : "?"}ts=${Date.now()}`;
  const res = await fetch(fresh, {
    headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export function emailScopedKey(eventId: string, email: string) {
  return createHash("sha256").update(`${eventId}:${email.toLowerCase()}`).digest("hex").slice(0, 24);
}

export function applicationPath(eventId: string, email: string) {
  return `app/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

export function teamPath(eventId: string, code: string) {
  return `team/${eventId}/${code}.json`;
}

export function teamMemberPath(eventId: string, email: string) {
  return `team-member/${eventId}/${emailScopedKey(eventId, email)}.json`;
}

export async function readJsonByPath(path: string) {
  const found = await list({ prefix: path, limit: 1 });
  const blob = found.blobs.find((b) => b.pathname === path);
  if (!blob) return null;
  return readPrivate(blob.url);
}

export async function putJson(path: string, data: unknown, overwrite: boolean) {
  return put(path, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

/**
 * Roster derived from per-member records rather than the team blob's own
 * `members[]`.
 *
 * Vercel Blob has no compare-and-swap, so `read team -> members.push() ->
 * write team` loses a joiner whenever two people join within the same moment:
 * both read the same array, both append, and the second write erases the
 * first. Each member instead owns one file under `team-member/<eventId>/`,
 * keyed by their email, so simultaneous joins touch different keys and cannot
 * collide. The roster is whoever holds a record for this code.
 */
export async function listTeamMembers(eventId: string, code: string) {
  const blobs = await listAll(`team-member/${eventId}/`);
  const records = await Promise.all(blobs.map((b) => readPrivate(b.url)));
  return records
    .filter((r: any) => r && r.code === code && r.member)
    .map((r: any) => r.member)
    .sort((a: any, b: any) => String(a.joinedAt).localeCompare(String(b.joinedAt)));
}
