import type { Application } from "@/lib/applications";
import { events, eventId, maxTeamsFor } from "@/lib/pravrutti-data";

/**
 * Reading the college's payment report, and deciding who it pays for.
 *
 * The report is the only record of money actually arriving: JUNO tells us
 * nothing, so until now an organiser matched it against the desk by eye, one
 * row at a time. This turns that reading into a plan an organiser can look at
 * before anything is written.
 *
 * The report says who paid and how much. It does NOT say which event they paid
 * for — every row is "Fest / Registration fee" — so the matching is by email
 * first. A payment whose email is not on the desk gets a second look by phone,
 * and two rules keep it honest.
 *
 * The count: a person with two payments can have two registrations approved,
 * not five. The rest are left for a human, listed rather than hidden.
 *
 * The clock: somebody registers for an event and then goes off to pay, so a
 * payment belongs to the registration made just before it. With two entries
 * and one payment, "just before" is the difference between confirming the
 * event they paid for and confirming the other one.
 */

/** One payment as the report states it. */
export type SheetPayment = {
  name: string;
  email: string;
  /** JUNO's Transaction Reference No — the thing a student is asked to quote. */
  transaction: string;
  amount: string;
  paidAt: string;
  /** As the report wrote it. Matching uses the last 10 digits. */
  phone: string;
};

const HEADER_KEYS: Record<keyof SheetPayment, RegExp> = {
  name: /^name$/i,
  email: /e-?mail/i,
  transaction: /transaction\s*(number|no|id|reference)/i,
  amount: /payment\s*amount|amount|total\s*fees/i,
  paidAt: /transaction\s*date|registration\s*date/i,
  phone: /mobile|phone/i,
};

/** Last 10 digits. Strips +91, a leading 0, spaces and dashes. Shorter than 10 is not a number. */
export function phoneLast10(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

const nameWords = (raw: string) =>
  raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((w) => w.length >= 4);

/** One insertion, deletion or substitution. */
const oneApart = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) return oneApart(b, a);
  let i = 0;
  let j = 0;
  let used = false;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (used) return false;
    used = true;
    if (a.length === b.length) i++;
    j++;
  }
  return true;
};

/**
 * The report name and the registration name are the same person.
 *
 * A shared word is enough ("Sanjay Kumar R P" / "Sanjay Kumar R P"), and a
 * one-letter spelling difference counts ("Varshitha" / "Varshita"). A phone
 * that lands on a different name does not.
 */
export function namesAgree(sheetName: string, siteName: string): boolean {
  const a = nameWords(sheetName);
  const b = nameWords(siteName);
  if (a.length === 0 || b.length === 0) return false;
  for (const x of a) {
    for (const y of b) {
      if (x === y) return true;
      if (x.length >= 6 && y.length >= 6 && oneApart(x, y)) return true;
    }
  }
  return false;
}

const clean = (v: unknown) => String(v ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/**
 * Finds the header wherever it sits.
 *
 * The report carries the university's name, who generated it and when above
 * the table, and that preamble changes between exports — so the header is
 * found by looking for the row that names the columns, not by counting lines.
 */
export function readSheetRows(grid: unknown[][]): SheetPayment[] {
  const headerIndex = grid.findIndex(
    (row) => row.some((c) => /e-?mail/i.test(clean(c))) && row.some((c) => /transaction/i.test(clean(c))),
  );
  if (headerIndex < 0) return [];

  const header = grid[headerIndex].map(clean);
  const columnFor = (probe: RegExp) => header.findIndex((h) => probe.test(h));
  const cols = {
    name: columnFor(HEADER_KEYS.name),
    email: columnFor(HEADER_KEYS.email),
    transaction: columnFor(HEADER_KEYS.transaction),
    amount: columnFor(HEADER_KEYS.amount),
    paidAt: columnFor(HEADER_KEYS.paidAt),
    phone: columnFor(HEADER_KEYS.phone),
  };
  if (cols.email < 0) return [];

  const at = (row: unknown[], i: number) => (i >= 0 ? clean(row[i]) : "");
  const out: SheetPayment[] = [];
  for (const row of grid.slice(headerIndex + 1)) {
    const email = at(row, cols.email).toLowerCase();
    if (!isEmail(email)) continue;
    out.push({
      name: at(row, cols.name),
      email,
      transaction: at(row, cols.transaction),
      amount: at(row, cols.amount),
      paidAt: at(row, cols.paidAt),
      phone: at(row, cols.phone),
    });
  }
  return out;
}

export type PlannedApproval = {
  eventId: string;
  eventName: string;
  email: string;
  name: string;
  ticketId: string;
  teamCode: string | null;
  /** Members who get confirmed along with this one. */
  teamSize: number;
  /** The reference to record, when the row does not already carry one. */
  transaction: string | null;
  /** When they registered and when the payment landed, so an organiser can
      see the pairing the clock produced rather than trusting it blind. */
  appliedAt: string;
  paidAt: string | null;
  /** email: the report address is the registration. phone: the second pass. */
  via: "email" | "phone";
  /** "matched by phone (sheet email X, site email Y)", when via is phone. */
  note: string | null;
  /** Set when this row is left out of the default approve set. */
  flag: string | null;
};

/** Paid, and already confirmed under a different email. Not unmatched. */
export type ConfirmedElsewhere = {
  name: string;
  email: string;
  phone: string;
  transaction: string;
  siteEmail: string;
  siteName: string;
  events: { eventName: string; teamName: string | null; teamCode: string | null; status: string }[];
};

/** A phone hit an organiser has to read. Never auto-approved. */
export type NeedsCheck = {
  name: string;
  email: string;
  phone: string;
  transaction: string;
  reason: string;
  detail: string;
};

export const FULL_OR_OVER_CAP = "event full / over cap";
export const DUPLICATE_PAYMENT = "possible duplicate payment";

export type SheetPlan = {
  /** Registrations this sheet pays for, ready to confirm. Full events are not in here. */
  approve: PlannedApproval[];
  /** Would have been approved, but the event is full or this would go over its cap. */
  held: PlannedApproval[];
  /** Paid, and no registration at all for that email or phone. */
  unmatched: SheetPayment[];
  /** Paid under another email, and every live registration on that phone is already confirmed. */
  confirmedElsewhere: ConfirmedElsewhere[];
  /** Phone hit we will not approve: different name, several emails, several events, or a duplicate. */
  needsCheck: NeedsCheck[];
  /** In review, owes a fee, and this sheet does not cover it. */
  unpaid: { eventId: string; eventName: string; email: string; name: string }[];
  /** Already confirmed before this sheet was read, on an email the report did match. */
  alreadyConfirmed: number;
  /** More registrations in review than payments, for one person. */
  short: { email: string; payments: number; inReview: number }[];
};

/** A registration this sheet could pay for: in review, and owing money. */
const owesPayment = (a: Application) =>
  a.status === "pending" && (a.payment === "awaiting" || a.payment === "paid");

/**
 * The report's clock, in the same units as ours.
 *
 * It writes "2026-09-16 12:38:16.0" with no zone, and the college portal
 * keeps local time — so a naive stamp is read as IST. Letting the runtime
 * guess instead would land every payment five and a half hours out, which is
 * long enough to pair it with the wrong event entirely.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function sheetTime(raw: string): number {
  const v = String(raw ?? "").trim();
  if (!v) return NaN;

  const naive = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (naive) {
    const [, y, mo, d, h, mi, sec] = naive;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec ?? 0)) - IST_OFFSET_MS;
  }
  /* Anything carrying its own zone ("…Z", "+05:30") is already unambiguous. */
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? NaN : parsed;
}

/**
 * Pairs each payment with the registration it most likely paid for.
 *
 * A student registers, is sent to the portal, and pays a few minutes later —
 * so the registration a payment belongs to is the latest one made BEFORE it.
 * Where the clocks disagree and nothing was registered first, the nearest
 * registration after the payment is taken instead, which is the same intent
 * read from the other side.
 */
export function pairByClock(
  payments: SheetPayment[],
  candidates: Application[],
): { application: Application; payment: SheetPayment }[] {
  const open = [...candidates].sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
  const taken = new Set<string>();
  const pairs: { application: Application; payment: SheetPayment }[] = [];

  for (const payment of [...payments].sort((a, b) => sheetTime(a.paidAt) - sheetTime(b.paidAt))) {
    const paid = sheetTime(payment.paidAt);
    const free = open.filter((a) => !taken.has(a.ticketId));
    if (free.length === 0) break;

    let chosen: Application | undefined;
    if (!Number.isNaN(paid)) {
      const before = free.filter((a) => Date.parse(a.appliedAt) <= paid);
      chosen = before.length
        ? before[before.length - 1]
        : free.find((a) => !Number.isNaN(Date.parse(a.appliedAt)));
    }
    /* No usable timestamp anywhere: fall back to the order they registered in,
       which is what this did before the report carried a clock. */
    chosen ??= free[0];
    taken.add(chosen.ticketId);
    pairs.push({ application: chosen, payment });
  }
  return pairs;
}

const teamBit = (a: Application) => ({
  eventName: a.eventName,
  teamName: a.teamName || null,
  teamCode: a.teamCode ?? null,
  status: a.status,
});

const describeHits = (rows: Application[]) =>
  rows
    .map((a) => {
      const team = a.teamCode ? `${a.teamName || "team"} (${a.teamCode})` : a.teamName || "solo";
      return `${a.name} <${a.email}> · ${a.eventName} · ${team} · ${a.status}`;
    })
    .join("; ");

const seatRule = new Map(events.map((e) => [eventId(e.name), { full: !!e.full, maxTeams: maxTeamsFor(e) }]));

/** Teams already confirmed on this event. A solo registration is its own team. */
function confirmedTeamCount(eventId: string, applications: Application[]): number {
  const codes = new Set<string>();
  let solos = 0;
  for (const a of applications) {
    if (a.eventId !== eventId || a.status !== "confirmed") continue;
    if (a.teamCode) codes.add(a.teamCode);
    else solos++;
  }
  return codes.size + solos;
}

/**
 * Full events, and rows that would take the confirmed count past the cap,
 * leave the default approve set. They stay visible, flagged.
 */
function splitByCap(candidates: PlannedApproval[], applications: Application[]): {
  approve: PlannedApproval[];
  held: PlannedApproval[];
} {
  const running = new Map<string, number>();
  const counted = new Set<string>();
  const approve: PlannedApproval[] = [];
  const held: PlannedApproval[] = [];
  for (const row of candidates) {
    const rule = seatRule.get(row.eventId) ?? { full: false, maxTeams: null };
    if (!running.has(row.eventId)) running.set(row.eventId, confirmedTeamCount(row.eventId, applications));
    const teamKey = row.teamCode ? `${row.eventId}:${row.teamCode}` : `${row.eventId}:solo:${row.email.toLowerCase()}`;
    const teamAlreadyConfirmed = row.teamCode
      ? applications.some((a) => a.eventId === row.eventId && a.teamCode === row.teamCode && a.status === "confirmed")
      : false;
    const addsTeam = !teamAlreadyConfirmed && !counted.has(teamKey);
    const next = (running.get(row.eventId) ?? 0) + (addsTeam ? 1 : 0);
    const over = rule.maxTeams != null && addsTeam && next > rule.maxTeams;
    if (rule.full || over) {
      held.push({ ...row, flag: FULL_OR_OVER_CAP });
      continue;
    }
    if (addsTeam) {
      counted.add(teamKey);
      running.set(row.eventId, next);
    }
    approve.push(row);
  }
  return { approve, held };
}

/**
 * Matches the report against the desk.
 *
 * Only the person charged is matched — teammates owe nothing and carry
 * "not_required", so they never appear here. They are confirmed anyway when
 * their lead is, which is what `teamSize` reports.
 *
 * Email first. A payment whose address is not on a live registration is tried
 * by phone: one site email, the name agrees, and exactly one registration in
 * review. Anything less certain is listed for a person to read, and a full
 * event is never in the set the confirm button sends.
 */
export function planFromSheet(payments: SheetPayment[], applications: Application[]): SheetPlan {
  const byEmail = new Map<string, SheetPayment[]>();
  for (const p of payments) {
    const key = p.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), p]);
  }

  const live = applications.filter((a) => a.status === "pending" || a.status === "confirmed");
  const rosterSize = (a: Application) =>
    a.teamCode
      ? live.filter((m) => m.eventId === a.eventId && m.teamCode === a.teamCode).length
      : 1;

  const candidates: PlannedApproval[] = [];
  const short: SheetPlan["short"] = [];
  const matchedEmails = new Set<string>();
  const usedTargets = new Set<string>();
  const usedRefs = new Set<string>();
  let alreadyConfirmed = 0;

  const refKey = (raw: string) => raw.trim().toUpperCase();
  const targetKey = (event: string, email: string) => `${event}:${email.toLowerCase()}`;

  const remember = (a: Application, payment: SheetPayment) => {
    usedTargets.add(targetKey(a.eventId, a.email));
    if (payment.transaction) usedRefs.add(refKey(payment.transaction));
  };

  const approvalFor = (
    a: Application,
    payment: SheetPayment,
    via: PlannedApproval["via"],
    note: string | null,
  ): PlannedApproval => ({
    eventId: a.eventId,
    eventName: a.eventName,
    email: a.email,
    name: a.name,
    ticketId: a.ticketId,
    teamCode: a.teamCode ?? null,
    teamSize: rosterSize(a),
    transaction: a.paymentRef ? null : payment.transaction || null,
    appliedAt: a.appliedAt,
    paidAt: payment.paidAt || null,
    via,
    note,
    flag: null,
  });

  for (const [email, theirPayments] of byEmail) {
    const mine = live
      .filter((a) => a.email.toLowerCase() === email)
      .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
    if (mine.length === 0) continue;
    matchedEmails.add(email);

    alreadyConfirmed += mine.filter((a) => a.status === "confirmed").length;
    const waiting = mine.filter(owesPayment);

    /* One payment buys one registration, and the clock says which one.
       Somebody with three entries in review and one payment gets the entry
       that payment followed; the rest stay for a human, counted in `short`. */
    if (waiting.length > theirPayments.length)
      short.push({ email, payments: theirPayments.length, inReview: waiting.length });

    for (const { application: a, payment } of pairByClock(theirPayments, waiting)) {
      candidates.push(approvalFor(a, payment, "email", null));
      remember(a, payment);
    }
  }

  const byPhone = new Map<string, Application[]>();
  for (const a of applications) {
    const ph = phoneLast10(a.phone);
    if (!ph) continue;
    byPhone.set(ph, [...(byPhone.get(ph) ?? []), a]);
  }

  const refsOnFile = new Set(
    applications.map((a) => (a.paymentRef ? refKey(a.paymentRef) : "")).filter(Boolean),
  );

  const confirmedElsewhere: ConfirmedElsewhere[] = [];
  const needsCheck: NeedsCheck[] = [];
  const unmatched: SheetPayment[] = [];

  const check = (payment: SheetPayment, reason: string, detail: string) => {
    needsCheck.push({
      name: payment.name,
      email: payment.email,
      phone: phoneLast10(payment.phone) || payment.phone,
      transaction: payment.transaction,
      reason,
      detail,
    });
  };

  for (const [email, theirPayments] of byEmail) {
    if (matchedEmails.has(email)) continue;
    const phone = theirPayments.map((p) => phoneLast10(p.phone)).find(Boolean) ?? "";
    const hits = phone ? (byPhone.get(phone) ?? []) : [];
    if (hits.length === 0) {
      unmatched.push(theirPayments[0]);
      continue;
    }

    const emails = [...new Set(hits.map((a) => a.email.toLowerCase()))];
    const agrees = (em: string) => hits.filter((a) => a.email.toLowerCase() === em).some((a) => namesAgree(theirPayments[0].name, a.name));
    const agreeEmails = emails.filter(agrees);
    const otherEmails = emails.filter((em) => !agrees(em));

    if (agreeEmails.length !== 1 || otherEmails.length > 0) {
      const reason = agreeEmails.length === 0
        ? "phone belongs to a different name"
        : "phone is on more than one site email";
      check(theirPayments[0], reason, describeHits(hits));
      continue;
    }

    const mine = hits.filter((a) => a.email.toLowerCase() === agreeEmails[0]);
    const inReview = mine.filter(owesPayment);
    if (inReview.length > 1) {
      const events = new Set(inReview.map((a) => a.eventId));
      check(
        theirPayments[0],
        events.size > 1 ? "more than one event is in review" : "more than one registration is in review",
        describeHits(mine),
      );
      continue;
    }
    if (inReview.length === 0) {
      const confirmed = mine.filter((a) => a.status === "confirmed");
      if (confirmed.length > 0) {
        confirmedElsewhere.push({
          name: theirPayments[0].name,
          email,
          phone,
          transaction: theirPayments.map((p) => p.transaction).filter(Boolean).join(", "),
          siteEmail: confirmed[0].email,
          siteName: confirmed[0].name,
          events: confirmed.map(teamBit),
        });
      } else {
        check(theirPayments[0], "registration is cancelled", describeHits(mine));
      }
      continue;
    }

    /* Exactly one registration in review. The clock still pairs it, which is
       the same rule as an email match with a single candidate. */
    for (const { application: a, payment } of pairByClock(theirPayments, inReview)) {
      const ref = payment.transaction ? refKey(payment.transaction) : "";
      const refUsedElsewhere = !!ref && refsOnFile.has(ref) && refKey(a.paymentRef ?? "") !== ref;
      const duplicate = usedTargets.has(targetKey(a.eventId, a.email)) || (!!ref && usedRefs.has(ref)) || refUsedElsewhere;
      if (duplicate) {
        check(payment, DUPLICATE_PAYMENT, describeHits([a]));
        continue;
      }
      const note = `matched by phone (sheet email ${email}, site email ${a.email.toLowerCase()})`;
      candidates.push(approvalFor(a, payment, "phone", note));
      remember(a, payment);
    }
    const paired = new Set(
      pairByClock(theirPayments, inReview).map((p) => p.payment.transaction),
    );
    for (const payment of theirPayments) {
      if (!paired.has(payment.transaction)) check(payment, DUPLICATE_PAYMENT, describeHits(inReview));
    }
  }

  const { approve, held } = splitByCap(candidates, applications);
  const approving = new Set(
    [...approve, ...held].map((a) => targetKey(a.eventId, a.email)),
  );
  const unpaid = live
    .filter((a) => owesPayment(a) && a.status === "pending")
    .filter((a) => !approving.has(targetKey(a.eventId, a.email)))
    .map((a) => ({ eventId: a.eventId, eventName: a.eventName, email: a.email, name: a.name }));

  return { approve, held, unmatched, confirmedElsewhere, needsCheck, unpaid, alreadyConfirmed, short };
}
