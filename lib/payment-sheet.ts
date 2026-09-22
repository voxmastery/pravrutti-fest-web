import type { Application } from "@/lib/applications";

/**
 * Reading the college's payment report, and deciding who it pays for.
 *
 * The report is the only record of money actually arriving: JUNO tells us
 * nothing, so until now an organiser matched it against the desk by eye, one
 * row at a time. This turns that reading into a plan an organiser can look at
 * before anything is written.
 *
 * The report says who paid and how much. It does NOT say which event they paid
 * for — every row is "Fest / Registration fee" — so the matching is by email,
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
};

const HEADER_KEYS: Record<keyof Omit<SheetPayment, never>, RegExp> = {
  name: /^name$/i,
  email: /e-?mail/i,
  transaction: /transaction\s*(number|no|id|reference)/i,
  amount: /payment\s*amount|amount|total\s*fees/i,
  paidAt: /transaction\s*date|registration\s*date/i,
};

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
};

export type SheetPlan = {
  /** Registrations this sheet pays for, ready to confirm. */
  approve: PlannedApproval[];
  /** Paid, but we cannot find a registration in review for that address. */
  unmatched: SheetPayment[];
  /** In review, owes a fee, and this sheet does not cover it. */
  unpaid: { eventId: string; eventName: string; email: string; name: string }[];
  /** Already confirmed before this sheet was read. */
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

/**
 * Matches the report against the desk.
 *
 * Only the person charged is matched — teammates owe nothing and carry
 * "not_required", so they never appear here. They are confirmed anyway when
 * their lead is, which is what `teamSize` reports.
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

  const approve: PlannedApproval[] = [];
  const short: SheetPlan["short"] = [];
  const matchedEmails = new Set<string>();
  let alreadyConfirmed = 0;

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
      approve.push({
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
      });
    }
  }

  const unmatched = [...byEmail.entries()]
    .filter(([email]) => !matchedEmails.has(email))
    .map(([, ps]) => ps[0]);

  const approving = new Set(approve.map((a) => `${a.eventId}:${a.email.toLowerCase()}`));
  const unpaid = live
    .filter((a) => owesPayment(a) && a.status === "pending")
    .filter((a) => !approving.has(`${a.eventId}:${a.email.toLowerCase()}`))
    .map((a) => ({ eventId: a.eventId, eventName: a.eventName, email: a.email, name: a.name }));

  return { approve, unmatched, unpaid, alreadyConfirmed, short };
}
