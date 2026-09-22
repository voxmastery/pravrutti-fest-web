import type { Application } from "@/lib/applications";
import { isLiveApplication } from "@/lib/applications";
import { listAll, readPrivate, readJsonByPath, putJson, applicationPath, teamPath } from "@/lib/blob-store";
import { DISCOVERIZE_EVENT_ID, DISCOVERIZE_FREE_FEE } from "@/lib/discoverize";
import type { Team } from "@/lib/teams";

/**
 * The two writes behind Discoverize's rounds: recording an abstract, and
 * putting a team through to the presentation round.
 *
 * Both act on the whole team. The entry is the team's, the abstract is the
 * team's, and the ₹200 is the team's — charging one member and confirming
 * another is how a team ends up half in the final round.
 *
 * Scoped to Discoverize alone. Every read and write below is addressed under
 * this one event id, so nothing here can reach another event's rows.
 */

async function allLiveRows(): Promise<Application[]> {
  const blobs = await listAll(`app/${DISCOVERIZE_EVENT_ID}/`);
  const raw = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  return raw
    .filter((a): a is Application => !!a?.email && isLiveApplication(a.status))
    .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
}

/** Everyone entered together: a team's roster, or a solo entrant alone. */
async function teamRows(match: { code?: string | null; email?: string | null }) {
  const rows = await allLiveRows();
  const code = String(match.code ?? "").trim().toUpperCase();
  if (code) {
    const found = rows.filter((r) => String(r.teamCode ?? "").toUpperCase() === code);
    return found.length ? found : null;
  }
  const email = String(match.email ?? "").trim().toLowerCase();
  const me = rows.find((r) => r.email.toLowerCase() === email);
  if (!me) return null;
  /* Any member's address identifies the team — the form is filled in by
     whoever happens to be at the keyboard, not necessarily the lead. */
  const mine = String(me.teamCode ?? "").toUpperCase();
  return mine ? rows.filter((r) => String(r.teamCode ?? "").toUpperCase() === mine) : [me];
}

/** Whoever carries the team's fee: the lead who created it, else the entrant. */
async function payerOf(rows: Application[]): Promise<Application> {
  const code = rows.find((r) => r.teamCode)?.teamCode;
  if (code) {
    const team = (await readJsonByPath(teamPath(DISCOVERIZE_EVENT_ID, code))) as Team | null;
    const lead = String(team?.createdByEmail ?? "").toLowerCase();
    const found = rows.find((r) => r.email.toLowerCase() === lead);
    if (found) return found;
  }
  /* No team record, or a lead who has since withdrawn: the earliest live
     entry carries it, which is the person who started the registration. */
  return rows[0];
}

const save = async (a: Application) => {
  await putJson(applicationPath(DISCOVERIZE_EVENT_ID, a.email), a, true);
  return a;
};

/**
 * The abstract arrived.
 *
 * Idempotent on purpose: the Google Form fires a webhook per submission and a
 * team may submit twice. The first arrival is the one recorded, so a second
 * does not quietly reset the clock the judges screen by.
 */
export async function markAbstractSubmitted(args: {
  email: string;
  source: "form" | "organiser";
  at?: string;
}) {
  const rows = await teamRows({ email: args.email });
  if (!rows) return null;
  const at = args.at ?? new Date().toISOString();
  const applications = await Promise.all(
    rows.map((r) =>
      save({
        ...r,
        round: {
          ...r.round,
          abstractSubmittedAt: r.round?.abstractSubmittedAt ?? at,
          abstractSource: r.round?.abstractSubmittedAt ? r.round.abstractSource : args.source,
        },
      }),
    ),
  );
  return { applications };
}

/**
 * The judges' decision.
 *
 * Nothing about money: Discoverize is free at every stage, so being put
 * through to the presentation round changes what a team's ticket says and
 * nothing else. There is no cap either — how many teams go through is the
 * judges' call, and a number in the code would be a second opinion nobody
 * asked for.
 */
export async function setShortlisted(args: {
  code?: string | null;
  email?: string | null;
  by: string;
  shortlisted: boolean;
}) {
  const rows = await teamRows({ code: args.code, email: args.email });
  if (!rows) return null;
  const payer = await payerOf(rows);

  const at = new Date().toISOString();
  const applications = await Promise.all(
    rows.map((r) => {
      const round = { ...r.round };
      if (args.shortlisted) {
        round.shortlistedAt = round.shortlistedAt ?? at;
        round.shortlistedBy = round.shortlistedBy ?? args.by;
      } else {
        delete round.shortlistedAt;
        delete round.shortlistedBy;
      }
      /* No money changes hands here — the entry was free and the final round
         is free too, so the row keeps the fee and payment it already had. */
      return save({ ...r, round: Object.keys(round).length ? round : undefined });
    }),
  );
  return { applications, payer: payer.email };
}

/**
 * Brings rows written under the old paid flow into this one.
 *
 * Discoverize used to charge at registration like every other event, so the
 * teams who registered before this change are sitting on a ₹200 nobody should
 * have asked them for. They become free registrations; anything the judges
 * have since shortlisted, and anything already paid, is left exactly alone.
 *
 * Idempotent, so running it twice changes nothing the second time.
 */
export async function migrateToFreeEntry() {
  const rows = await allLiveRows();
  /* Anything still carrying a charge, or an older wording of the fee, from
     before Discoverize went free. Money that actually arrived ("paid") is
     left exactly as it is. */
  const stale = rows.filter((r) => r.payment === "awaiting" || r.fee !== DISCOVERIZE_FREE_FEE);
  const applications = await Promise.all(
    stale
      .filter((r) => r.payment !== "paid" || r.fee !== DISCOVERIZE_FREE_FEE)
      .map((r) =>
        save({
          ...r,
          payment: r.payment === "paid" ? "paid" : "not_required",
          fee: DISCOVERIZE_FREE_FEE,
        }),
      ),
  );
  return { applications, converted: applications.length, looked: rows.length };
}

/** The rows a desk needs to see: every live team, grouped, newest last. */
export async function discoverizeRoster() {
  const rows = await allLiveRows();
  const groups = new Map<string, Application[]>();
  for (const r of rows) {
    const key = r.teamCode ? `code:${String(r.teamCode).toUpperCase()}` : `solo:${r.email.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}
