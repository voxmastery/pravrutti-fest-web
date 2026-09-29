import { applicationPath, readJsonByPath } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
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
