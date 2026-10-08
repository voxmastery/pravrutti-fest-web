import "server-only";
import type { Application } from "@/lib/applications";
import { readJsonByPath, teamPath } from "@/lib/blob-store";
import { DISCOVERIZE_FREE_FEE, DISCOVERIZE_ROUND_FEE, isDiscoverize } from "@/lib/discoverize";
import { readShortlistFlag, seedListedLeads, type ShortlistFlag } from "@/lib/discoverize-shortlist-flags";
import { normalizeTeamCode, type Team } from "@/lib/teams";

/**
 * The first Discoverize teams the coordinators shortlisted, named by the
 * email of whoever carries the team's fee — the team lead, or a solo entrant.
 *
 * Kept here so that set is shortlisted even when the database flag has not
 * been written yet. A coordinator adds the next team from the screening desk
 * (/dashboard/discoverize), which stores a flag (lib/discoverize-shortlist-flags).
 * A team is shortlisted when either names it. An explicit removal in the
 * database wins over this list, so taking a team off the desk actually
 * takes them off.
 *
 * Server-only on purpose: these are students' addresses, and nothing that
 * reaches the browser may import this file.
 *
 * Lowercase. The desk is how the next team is added; this list is the named sets.
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
  /* Second set — Aailyah, 8 Oct 2026. Matched to the live roster: team name
     plus lead, or the solo entrant's name where the roster has no team name. */
  "arjun.ft1953@gmail.com", // Cosmiks (solo)
  "manyarajen1234@gmail.com", // Bizwizards
  "saikiran.m.nijaguli@gmail.com", // FactFinders
  "poojaumamagesh2007@gmail.com", // Genesis
  "abhinavnair.sv1@gmail.com", // Abhinav V (solo)
  "vk.personal27@gmail.com", // VIMAL KANTH (solo)
  "vkirananath@gmail.com", // Innovexa
];

const LISTED = new Set(DISCOVERIZE_SHORTLIST.map((e) => e.trim().toLowerCase()));

/** When the first set arrived (6 Oct 2026, 11:14 PM IST), stamped on rows the list shortlists. */
export const SHORTLIST_LIST_AT = "2026-10-06T17:44:00.000Z";
export const SHORTLIST_LIST_BY = "coordinators' shortlist (lib/discoverize-shortlist)";

export const onDiscoverizeShortlist = (email: string | null | undefined) =>
  LISTED.has(String(email ?? "").trim().toLowerCase());

/**
 * Seeds the first set into the shortlist table. Idempotent, and safe to run
 * on every boot: a lead already toggled is left exactly as the desk left them.
 */
export async function ensureDiscoverizeShortlistSeed() {
  await seedListedLeads(DISCOVERIZE_SHORTLIST, SHORTLIST_LIST_BY, SHORTLIST_LIST_AT);
}

const norm = (email: string | null | undefined) => String(email ?? "").trim().toLowerCase();

/**
 * Whether this address is on the shortlist right now.
 *
 * A stored flag answers first. No flag means the hardcoded list, which is
 * how the first set stays shortlisted before the table is seeded and after
 * a read of it fails. A flag that says removed answers no, list or not.
 */
async function namedShortlisted(email: string | null): Promise<{ yes: boolean; flag: ShortlistFlag | null }> {
  if (!email) return { yes: false, flag: null };
  const flag = await readShortlistFlag(email);
  if (flag) return { yes: flag.shortlisted, flag };
  return { yes: onDiscoverizeShortlist(email), flag: null };
}

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
 * Shortlisted means the hardcoded list or a database flag says so. An
 * explicit removal is neither, so the row comes back as stored.
 *
 * Any other row — another event, a Discoverize team nobody shortlisted, a
 * withdrawn or declined entry — comes back exactly as it went in.
 */
export async function withDiscoverizeShortlist(a: Application): Promise<Application> {
  if (!a || !isDiscoverize(a.eventId)) return a;
  if (a.status !== "pending" && a.status !== "confirmed") return a;

  /* The list and the flags name payers. A teammate is shortlisted through
     their lead; only that payer owes the fee. */
  const leadEmail = await leadOf(a);
  const payerEmail = leadEmail || norm(a.email);
  const decision = await namedShortlisted(payerEmail);
  const isPayer = norm(a.email) === payerEmail;

  if (!decision.yes) {
    /* An explicit removal wins over a mark already stored on the row, so
       Remove shortlist undoes the pay step even for a lead the list names.
       Paid and confirmed rows are never rewritten here. */
    if (
      decision.flag &&
      !decision.flag.shortlisted &&
      a.status === "pending" &&
      a.payment !== "paid" &&
      (a.round?.shortlistedAt || (isPayer && a.payment === "awaiting"))
    ) {
      const round = { ...a.round };
      delete round.shortlistedAt;
      delete round.shortlistedBy;
      delete round.paymentSubmittedAt;
      return {
        ...a,
        round: Object.keys(round).length ? round : undefined,
        ...(isPayer && a.payment === "awaiting"
          ? { payment: "not_required" as const, fee: DISCOVERIZE_FREE_FEE }
          : {}),
      };
    }
    return a;
  }

  const round = {
    ...a.round,
    shortlistedAt: a.round?.shortlistedAt ?? decision.flag?.at ?? SHORTLIST_LIST_AT,
    shortlistedBy: a.round?.shortlistedBy ?? decision.flag?.by ?? SHORTLIST_LIST_BY,
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
