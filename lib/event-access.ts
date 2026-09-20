import "server-only";
import { applicationPath, readJsonByPath } from "@/lib/blob-store";
import { isLiveApplication, type Application, type AppStatus } from "@/lib/applications";
import { resolveEmail } from "@/lib/identity";
import { resolveRole, canViewEvent } from "@/lib/roles";

export type EventAccess = {
  /** True when this viewer may see the private details of this event. */
  entitled: boolean;
  /** True when this viewer has a live application for this event (pending or
      confirmed), or is staff who may run it. Declined does not count. This is
      the Contact/More bar — a lower gate than `entitled`, which still holds
      the hall. Coordinator call numbers are public. */
  registered: boolean;
  /** Why not, when they may not — the UI words the two cases differently. */
  reason: "signin" | "not-approved" | "approved" | "staff";
  /** This viewer's own application to this event, if they have one. Null for
      staff and for anyone who never applied. */
  status: AppStatus | null;
  /** They left for the payment portal and have not come back with a reference.
      The application exists, so the page must not offer to start another —
      but it must offer the way to finish this one, or the tab they lost is
      the only place that step ever existed. */
  awaitingReference: boolean;
  /** They left for the portal and never said how it went. A subset of
      awaitingReference: the rest answered "yes" without an ID, which is a
      finished registration that merely lacks an optional extra. */
  unanswered: boolean;
};

/**
 * Who this viewer is, relative to one event.
 *
 * Extracted so the exact hall and the "your registration is pending" line
 * answer to the *same* check rather than near-copies that can drift apart.
 * The hall is private data about rooms, so a second implementation of "is
 * this person approved" is a second chance to get it wrong.
 *
 * "confirmed" is the bar because it is set by the same step that emails the QR
 * ticket — approved here means approved in the participant's inbox too.
 */
export async function resolveEventAccess(slug: string): Promise<EventAccess> {
  /* Session only. Reading an email from the query string would let anyone
     unlock an event by naming a participant they know is registered. */
  const email = await resolveEmail();
  if (!email)
    return { entitled: false, registered: false, reason: "signin", status: null, awaitingReference: false, unanswered: false };

  const role = await resolveRole();
  if (canViewEvent(role, slug)) {
    return { entitled: true, registered: true, reason: "staff", status: null, awaitingReference: false, unanswered: false };
  }

  const record = (await readJsonByPath(applicationPath(slug, email))) as Application | null;
  const status = record?.status ?? null;
  const registered = isLiveApplication(status);
  const awaitingReference =
    status === "pending" && record?.payment === "awaiting" && !record?.paymentRef;
  const unanswered = awaitingReference && record?.stage === "intent";

  return status === "confirmed"
    ? { entitled: true, registered, reason: "approved", status, awaitingReference, unanswered }
    : { entitled: false, registered, reason: "not-approved", status, awaitingReference, unanswered };
}
