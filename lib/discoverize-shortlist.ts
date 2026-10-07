import "server-only";
import type { Application } from "@/lib/applications";
import { readJsonByPath, teamPath } from "@/lib/blob-store";
import { DISCOVERIZE_ROUND_FEE, isDiscoverize } from "@/lib/discoverize";
import { normalizeTeamCode, type Team } from "@/lib/teams";

/**
 * The Discoverize teams the coordinators have shortlisted, named by the email
 * of whoever carries the team's fee — the team lead, or a solo entrant.
 *
 * In code rather than in the database because the coordinators send the
 * shortlist as a list, and a list in a commit is one line per team to append,
 * reviewable, and live on the next deploy with nobody needing the desk. The
 * shortlist desk (/dashboard/discoverize) still works alongside it: a team
 * shortlisted there is written as shortlisted and owing, and is just as
 * payable.
 *
 * Server-only on purpose: these are students' addresses, and nothing that
 * reaches the browser may import this file.
 *
 * Lowercase. To add the next set, append below.
 */
export const DISCOVERIZE_SHORTLIST: readonly string[] = [
  /* First set — Aailyah, 6 Oct 2026. Every address checked against the live
     roster on 7 Oct: each is the team lead, or the entrant for a solo entry. */
  "mallikarjunass@jnnce.ac.in", // Duo Squad
  "sameerakrishnaprao@gmail.com", // Sameera Krishna P (solo)
  "vamshikrishms@gmail.com", // One Man IC (solo)
  "kssambavi06@gmail.com", // Recharge
  "dhirajkumarbiswal.06@gmail.com", // Dhiraj Kumar Biswal (solo)
  "vvce23me0103@vvce.ac.in", // Mech Masters
  "girishkshatribscr25@rvu.edu.in", // Apex
  "shruti.2005.18@gmail.com", // PharmTechies
  "bhumikagowda2303@gmail.com", // Crimson Dragons
  "naveen.a.patil7@gmail.com", // ReScience
  "padmavathipattar01@gmail.com", // Team aplha (solo)
  "kavanamallesh2006@gmail.com", // Kavana B M
  "manipisahith@gmail.com", // Binco
  "nayanasree1906@gmail.com", // Nayanasree (solo)
];

const LISTED = new Set(DISCOVERIZE_SHORTLIST.map((e) => e.trim().toLowerCase()));

/** When the first set arrived (6 Oct 2026, 11:14 PM IST), stamped on rows the list shortlists. */
export const SHORTLIST_LIST_AT = "2026-10-06T17:44:00.000Z";
export const SHORTLIST_LIST_BY = "coordinators' shortlist (lib/discoverize-shortlist)";

export const onDiscoverizeShortlist = (email: string | null | undefined) =>
  LISTED.has(String(email ?? "").trim().toLowerCase());

/** The lead of this row's team, if it has one and the team record can be read. */
async function leadOf(a: Application): Promise<string | null> {
  const code = normalizeTeamCode(String(a.teamCode ?? ""));
  if (!code) return null;
  try {
    const team = (await readJsonByPath(teamPath(a.eventId, code))) as Team | null;
    return team && !team.deletedAt ? String(team.createdByEmail ?? "").trim().toLowerCase() || null : null;
  } catch {
    /* A team record that cannot be read leaves the row exactly as stored. */
    return null;
  }
}

/**
 * A Discoverize row as the coordinators' shortlist makes it read.
 *
 * A view, never a write: the row is returned as shortlisted — and, for the
 * team's payer, as owing the Rs. 200/- round fee — while what is stored stays
 * untouched until the student acts on it (attaching a JUNO reference saves
 * this view) or an organiser verifies the payment. Every path that decides
 * what a Discoverize team may do reads rows through here: the event page and
 * ticket, the register route's reference step, the payment verification
 * guard, the shortlist desk, and the registrations desk.
 *
 * Any other row — another event, a Discoverize team not on the list, a
 * withdrawn or declined entry — comes back exactly as it went in.
 */
export async function withDiscoverizeShortlist(a: Application): Promise<Application> {
  if (!a || !isDiscoverize(a.eventId)) return a;
  if (a.status !== "pending" && a.status !== "confirmed") return a;

  /* The list names payers, so a listed address is the one that pays. A
     teammate is shortlisted through their lead. */
  const isPayer = onDiscoverizeShortlist(a.email);
  const listed = isPayer || onDiscoverizeShortlist(await leadOf(a));
  if (!listed) return a;

  const round = {
    ...a.round,
    shortlistedAt: a.round?.shortlistedAt ?? SHORTLIST_LIST_AT,
    shortlistedBy: a.round?.shortlistedBy ?? SHORTLIST_LIST_BY,
  };
  /* Only the payer owes, and only while nothing has been settled: a row
     already awaiting or paid keeps the money state it has. */
  const owes = isPayer && a.status === "pending" && a.payment === "not_required";
  return {
    ...a,
    round,
    ...(owes ? { payment: "awaiting" as const, fee: DISCOVERIZE_ROUND_FEE } : {}),
  };
}
