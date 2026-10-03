import { listAll, readPrivate } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
import { eventId, maxTeamsFor, capacityInPeople, type Event } from "@/lib/pravrutti-data";
import { countRegistrations, type RegistrationCounts } from "@/lib/registration-counts";

/**
 * Whether an event is taking new teams.
 *
 * Two ways to be full. An organiser can switch an event to full by hand
 * (Event.full) — it then stays shut until they reopen it, even if declines
 * bring it back under its cap, so a place being decided mid-review is never
 * handed to a stranger. And any event with a cap closes on its own when the
 * places held reach it, and reopens on its own if they fall back below.
 *
 * "Held" is the desk's own count (lib/registration-counts): in review and
 * confirmed hold a place; somebody who withdrew, was declined, or left for
 * the payment portal and never came back with a receipt does not. Counting
 * those would let a handful of abandoned attempts shut an event with room.
 *
 * Full means no new entry — no new team, no new lead or solo registration.
 * Teams already in can still grow; see lib/lead-decision leadIsRegistered.
 */

/** The cap an event is measured against, in the unit it is stated in. */
export function capOf(e: Event): { limit: number; unit: "teams" | "people" } | null {
  const teams = maxTeamsFor(e);
  if (teams) return { limit: teams, unit: "teams" };
  const people = capacityInPeople(e);
  return people ? { limit: people, unit: "people" } : null;
}

export function isFull(e: Event, held: Pick<RegistrationCounts, "people" | "teams">): boolean {
  if (e.full) return true;
  const cap = capOf(e);
  if (!cap) return false;
  return (cap.unit === "teams" ? held.teams : held.people) >= cap.limit;
}

/** The server-side check, reading this event's registrations. */
export async function eventIsFull(e: Event): Promise<boolean> {
  if (e.full) return true;
  if (!capOf(e)) return false;
  const id = eventId(e.name);
  const blobs = await listAll(`app/${id}/`);
  const rows = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  return isFull(e, countRegistrations(rows.filter((r): r is Application => !!r && r.eventId === id)));
}
