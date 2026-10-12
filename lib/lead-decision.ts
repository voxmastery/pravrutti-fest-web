import { applicationPath, readJsonByPath } from "@/lib/blob-store";
import { isLiveApplication, type Application } from "@/lib/applications";
import type { Team } from "@/lib/teams";

/**
 * Whether a team has already been approved, as far as a newcomer is concerned.
 *
 * A team that has been through the desk brings its newest member in with it.
 * The decision was taken about the team — the fee is the lead's one Rs. 200
 * and a later member adds nothing to it — so leaving them "In review" hands
 * them a ticket that never moves, waiting on an organiser who has already
 * decided and will not decide again.
 *
 * The lead's own registration is where that decision lives: the team blob
 * records who is on the team, not what the desk made of them. A lead who
 * withdrew or was declined is not an approval, and no registration at all
 * means the lead invited before submitting — the ordinary case, and not a
 * confirmation.
 *
 * This lives here rather than beside any one caller because there are three
 * ways onto a team — the invite link, the lead adding someone, and the team
 * code — and a student should get the same answer whichever way their lead
 * used. Two of the three did not know this rule, so the code-join route left
 * teammates stranded in review behind a confirmed lead.
 */
export async function leadIsConfirmed(evId: string, team: Team | null): Promise<boolean> {
  const lead = String(team?.createdByEmail ?? "").trim().toLowerCase();
  if (!lead) return false;
  const app = (await readJsonByPath(applicationPath(evId, lead))) as Application | null;
  return app?.status === "confirmed";
}

/**
 * Whether a team is already in the field: its lead holds a live registration,
 * in review or confirmed.
 *
 * What decides who may still join once an event is full (Event.full). A team
 * whose lead is registered is in, and its members joining adds no new team;
 * a team whose lead never registered is not, and cannot get in now — letting
 * people join it would only hand them a ticket that can never be confirmed.
 */
export async function leadIsRegistered(evId: string, team: Team | null): Promise<boolean> {
  const lead = String(team?.createdByEmail ?? "").trim().toLowerCase();
  if (!lead) return false;
  const app = (await readJsonByPath(applicationPath(evId, lead))) as Application | null;
  return isLiveApplication(app?.status);
}

/**
 * Whether this lead may add a teammate, as far as the registration window goes.
 *
 * An event's own earlier close, or the event being full, stops new teams.
 * It does not stop a team that is already in from filling its own slots —
 * the caller allows a lead who is in review or confirmed to keep adding
 * after the fest-wide date as well. This helper is only the Discoverize
 * shortlist exception for a lead who is not otherwise let through.
 *
 * A full roster, someone who is not the lead, and a duplicate email are
 * refused on their own; this only answers the window.
 */
export function leadMayInvite(args: {
  registrationOpen: boolean;
  leadRegistered?: boolean;
  /** Discoverize only. A shortlisted lead who already registered may still
      add after Discoverize's own close. No other closed event gets this. */
  discoverizeShortlisted?: boolean;
}): boolean {
  if (args.registrationOpen) return true;
  return Boolean(args.discoverizeShortlisted && args.leadRegistered);
}
