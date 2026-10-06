import "server-only";
import { COVERED_BY_LEAD, feeForApplicant, isLiveApplication, type Application } from "@/lib/applications";
import { applicationPath, listTeamMembers, putJson, readJsonByPath, teamPath } from "@/lib/blob-store";
import type { Event } from "@/lib/pravrutti-data";
import type { Team } from "@/lib/teams";

/**
 * A lead handing their team to a teammate.
 *
 * The organisers' rule (6 Oct 2026): a lead can hand over at any time, and the
 * new lead manages the team from then on — adds, removes, deletes. Money does
 * not follow the role: a payment stays recorded against whoever made it,
 * because that is whose name is on the college's statement. Only a lead who
 * hasn't paid yet — no payment, no payment ID, not confirmed — hands over the
 * duty to pay with the role, exactly as the organisers' set_lead does.
 */
export type TransferResult =
  | { ok: true; team: Team; moved: "role" | "role_and_fee" }
  | { ok: false; status: number; error: string };

const unpaid = (a: Application) =>
  a.status !== "confirmed" && a.payment !== "paid" && !String(a.paymentRef ?? "").trim();

export async function transferLead(args: {
  evId: string;
  event: Event;
  team: Team;
  from: string;
  to: string;
}): Promise<TransferResult> {
  const { evId, event, team } = args;
  const from = args.from.trim().toLowerCase();
  const to = args.to.trim().toLowerCase();
  const code = String(team.code).trim().toUpperCase();

  if (String(team.createdByEmail).trim().toLowerCase() !== from)
    return { ok: false, status: 403, error: "Only the team lead can hand the team over." };
  if (to === from) return { ok: false, status: 409, error: "You already lead this team." };

  const next = (await readJsonByPath(applicationPath(evId, to))) as Application | null;
  if (!next || !isLiveApplication(next.status) || String(next.teamCode ?? "").trim().toUpperCase() !== code)
    return {
      ok: false, status: 409,
      error: "Only someone registered on this team can lead it. Add them first, or ask them to join with the code.",
    };

  const prev = (await readJsonByPath(applicationPath(evId, from))) as Application | null;
  const free = event.fee.toLowerCase().startsWith("free");
  const moveFee = !free && !!prev && isLiveApplication(prev.status) && prev.fee !== COVERED_BY_LEAD && unpaid(prev);
  const at = new Date().toISOString();

  /* The new lead first: if a later write fails, the team still has a lead
     who owes the fee, rather than nobody. */
  if (moveFee) {
    const lead = feeForApplicant({ eventFree: false, eventFee: event.fee, isJoiner: false });
    await putJson(
      applicationPath(evId, to),
      { ...next, payment: lead.payment, fee: lead.fee, paymentRef: null, stage: "intent" as const },
      true,
    );
  }
  const updated: Team = {
    ...team,
    createdByEmail: to,
    ...({ previousLead: from, leadChangedBy: from, leadChangedAt: at } as object),
  } as Team;
  await putJson(teamPath(evId, team.code), updated, true);
  if (moveFee && prev) {
    const mate = feeForApplicant({ eventFree: false, eventFee: event.fee, isJoiner: true });
    const { stage: _stage, ...rest } = prev;
    await putJson(applicationPath(evId, from), { ...rest, payment: mate.payment, fee: mate.fee, paymentRef: null }, true);
  }
  return { ok: true, team: updated, moved: moveFee ? "role_and_fee" : "role" };
}

/**
 * Whether this person's own payment is what holds their team's place.
 *
 * After a hand-over the person who paid may no longer be the lead, and until
 * that payment is verified it is the only thing keeping the team in the
 * event. Letting them leave would take the team's place with them, so they
 * can't — until the team is confirmed, when everyone on it holds their own.
 */
export async function paymentHoldsTeam(evId: string, app: Application | null, team: Team | null): Promise<boolean> {
  if (!app || !team || !isLiveApplication(app.status) || app.status === "confirmed") return false;
  if (app.fee === COVERED_BY_LEAD || String(app.fee).toLowerCase().startsWith("free")) return false;
  if (app.payment !== "paid" && !String(app.paymentRef ?? "").trim()) return false;
  const email = String(app.email).trim().toLowerCase();
  const others = (await listTeamMembers(evId, team.code)).filter(
    (m: { email?: string }) => String(m?.email ?? "").trim().toLowerCase() !== email,
  );
  return others.length > 0;
}

export const PAYMENT_HOLDS_TEAM =
  "This payment is what holds the team's place until the organisers verify it, so it can't leave the team yet. Once the team is confirmed it can.";
