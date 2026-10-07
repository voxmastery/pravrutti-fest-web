import type { Application } from "@/lib/applications";
import { isLiveApplication } from "@/lib/applications";
import { listAll, readPrivate, readJsonByPath, putJson, applicationPath, teamPath } from "@/lib/blob-store";
import { DISCOVERIZE_EVENT_ID, DISCOVERIZE_FREE_FEE, DISCOVERIZE_ROUND_FEE } from "@/lib/discoverize";
import { withDiscoverizeShortlist } from "@/lib/discoverize-shortlist";
import { putShortlistFlag } from "@/lib/discoverize-shortlist-flags";
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
 * The judges' decision, and the fee that follows it.
 *
 * Shortlisting is what makes the ₹200 real: it lands on the payer's row as
 * "awaiting", which is the same state every other event's lead sits in before
 * an organiser verifies the money — so the event page's Pay button, the
 * reference step and the verification desk all work on it unchanged.
 * Teammates are marked shortlisted and owe nothing; the lead pays once.
 *
 * There is no cap here. How many teams go through is the judges' call, and a
 * number in the code would be a second opinion nobody asked for.
 */
export async function setShortlisted(args: {
  code?: string | null;
  email?: string | null;
  by: string;
  shortlisted: boolean;
}): Promise<{ applications: Application[]; payer: string } | { error: string } | null> {
  const rows = await teamRows({ code: args.code, email: args.email });
  if (!rows) return null;
  const payer = await payerOf(rows);

  /* Paid or already confirmed: the fee landed, or an organiser has cleared
     the team. Taking the shortlist off would disagree with both. */
  if (!args.shortlisted && rows.some((r) => r.payment === "paid" || r.status === "confirmed"))
    return { error: "That team has already paid or been confirmed for the final round. Decline it instead if they are out." };

  const at = new Date().toISOString();
  /* The flag is the decision the desk made. Written before the rows so a
     failed save can be retried, and a removal is what the view believes
     even if a row still carries an older mark. Who, and when, stay on it. */
  await putShortlistFlag(
    payer.email,
    args.shortlisted,
    args.shortlisted ? (payer.round?.shortlistedBy ?? args.by) : args.by,
    args.shortlisted ? (payer.round?.shortlistedAt ?? at) : at,
  );
  const applications = await Promise.all(
    rows.map((r) => {
      const isPayer = r.email.toLowerCase() === payer.email.toLowerCase();
      const round = { ...r.round };
      if (args.shortlisted) {
        round.shortlistedAt = round.shortlistedAt ?? at;
        round.shortlistedBy = round.shortlistedBy ?? args.by;
      } else {
        delete round.shortlistedAt;
        delete round.shortlistedBy;
        delete round.paymentSubmittedAt;
      }
      /* Only the payer's row carries money, only while it is still pending,
         and money that actually arrived ("paid") is never rewritten. */
      const touchMoney = isPayer && r.status === "pending" && r.payment !== "paid";
      const next: Application = {
        ...r,
        round: Object.keys(round).length ? round : undefined,
        ...(touchMoney
          ? args.shortlisted
            ? { payment: "awaiting" as const, fee: DISCOVERIZE_ROUND_FEE }
            : { payment: "not_required" as const, fee: DISCOVERIZE_FREE_FEE }
          : {}),
      };
      return save(next);
    }),
  );
  return { applications, payer: payer.email };
}

/**
 * Brings rows written under the old paid-at-entry flow into this one.
 *
 * Discoverize used to charge at registration like every other event, so the
 * teams who registered before entry went free were sitting on a ₹200 nobody
 * should have asked them for. They become free registrations; anything the
 * judges have shortlisted (which now owes the round fee on purpose), and
 * anything already paid, is left exactly alone.
 *
 * Idempotent, so running it twice changes nothing the second time.
 */
export async function migrateToFreeEntry() {
  const rows = await allLiveRows();
  const stale = rows.filter(
    (r) => !r.round?.shortlistedAt && (r.payment === "awaiting" || r.fee !== DISCOVERIZE_FREE_FEE),
  );
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

/**
 * The rows a desk needs to see: every live team, grouped, newest last — read
 * through the coordinators' shortlist so a listed team shows as shortlisted
 * and owing before anybody has touched its row.
 */
export async function discoverizeRoster() {
  const rows = await Promise.all((await allLiveRows()).map((r) => withDiscoverizeShortlist(r)));
  const groups = new Map<string, Application[]>();
  for (const r of rows) {
    const key = r.teamCode ? `code:${String(r.teamCode).toUpperCase()}` : `solo:${r.email.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}
