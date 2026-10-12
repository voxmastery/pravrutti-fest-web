import "server-only";
import { listAll, readPrivate } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
import { closedOutRows, reviewClosed } from "@/lib/registration-counts";

/**
 * Whether this one registration has been closed out: in review on an event
 * whose review has closed, on a team nobody on which is confirmed (see
 * closedOutRows). The student is shown it as declined — "Not confirmed".
 *
 * Reads the rest of the event only for a pending team registration on such
 * an event; every other ticket answers without a read.
 */
export async function isClosedOut(r: Application): Promise<boolean> {
  if (r.status !== "pending" || !reviewClosed(r.eventId)) return false;
  if (!r.teamCode) return true;
  const others = (await Promise.all((await listAll(`app/${r.eventId}/`)).map((b) => readPrivate(b.url))))
    .filter(Boolean) as Application[];
  const self = String(r.email).trim().toLowerCase();
  return closedOutRows([r, ...others.filter((o) => String(o.email).trim().toLowerCase() !== self)]).has(r);
}
