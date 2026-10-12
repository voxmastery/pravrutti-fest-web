import { createHash } from "crypto";
import { events, eventId } from "@/lib/pravrutti-data";
import type { Application } from "@/lib/applications";

export type TicketPayload = {
  ticketId: string;
  eventId: string;
  email: string;
};

/** How long a desk may take a check-in back. After this the stamp stands. */
export const UNDO_WINDOW_MS = 30_000;

export function eventNameFor(id: string): string {
  return events.find((e) => eventId(e.name) === id)?.name ?? id;
}

/** Digits only, so a phone typed with spaces still matches the stored one. */
export function phoneDigits(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Same key `applicationPath` uses. Kept here so a dry-run can check paths without opening the database. */
export function applicationKey(eventId: string, email: string) {
  return createHash("sha256").update(`${eventId}:${email.toLowerCase()}`).digest("hex").slice(0, 24);
}

export type DryRunReason =
  | "ok"
  | "missing_ticket"
  | "missing_email"
  | "missing_event"
  | "payload_mismatch"
  | "email_mismatch"
  | "path_not_found"
  | "status_not_confirmed"
  | "duplicate_ticket";

/**
 * Read-only verdict for one stored registration. It never writes.
 * `path` is the kv key the row was read from. When a dump has no key, pass
 * the key this email would use so only identity problems are reported.
 */
export function classifyStoredTicket(input: {
  path: string | null;
  ticketId?: string | null;
  eventId?: string | null;
  email?: string | null;
  status?: string | null;
  ticketCopies: number;
  knownPaths: Set<string> | null;
}): { ok: boolean; reason: DryRunReason } {
  const ticketId = String(input.ticketId ?? "").trim();
  const event = String(input.eventId ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (input.status && input.status !== "confirmed") return { ok: false, reason: "status_not_confirmed" };
  if (!ticketId) return { ok: false, reason: "missing_ticket" };
  if (!email) return { ok: false, reason: "missing_email" };
  if (!event) return { ok: false, reason: "missing_event" };
  if (input.ticketCopies > 1) return { ok: false, reason: "duplicate_ticket" };
  const payload = `${ticketId}|${event}|${email}`;
  const parsed = parseTicketPayload(payload);
  if (!parsed || parsed.ticketId !== ticketId || parsed.eventId !== event || parsed.email !== email) {
    return { ok: false, reason: "payload_mismatch" };
  }
  const expected = `app/${event}/${applicationKey(event, email)}.json`;
  if (input.path && input.path !== expected) {
    if (input.knownPaths && !input.knownPaths.has(expected)) return { ok: false, reason: "path_not_found" };
    return { ok: false, reason: "email_mismatch" };
  }
  if (input.knownPaths && !input.knownPaths.has(expected)) return { ok: false, reason: "path_not_found" };
  return { ok: true, reason: "ok" };
}

/**
 * Parses the string encoded into a ticket QR by `ticketPayload` in
 * lib/ticket-qr.ts (`${ticketId}|${eventId}|${email}`). Every producer — the
 * ticket page, the confirmation email, /api/status — has to go through that
 * helper so this parser cannot drift from what gets printed.
 *
 * Returns null for anything else, so a stray QR from another app is a clean
 * rejection rather than a lookup against garbage.
 */
export function parseTicketPayload(raw: string): TicketPayload | null {
  const parts = String(raw ?? "").trim().split("|");
  if (parts.length !== 3) return null;

  const [ticketId, eventId, email] = parts.map((p) => p.trim());
  if (!ticketId || !eventId || !email) return null;

  return { ticketId, eventId, email: email.toLowerCase() };
}

export type AdmitBlock =
  | { admit: true }
  | {
      admit: false;
      tone: "warn" | "err";
      code: "in_review" | "unpaid" | "cancelled" | "declined";
      message: string;
    };

/**
 * A ticket admits somebody only while their application is confirmed.
 * In review and unpaid are the help desk's problem (amber). Cancelled and
 * declined are a hard no (red). The wording keeps the status name in the
 * sentence because the desk reads it out loud.
 */
export function admissionBlock(status: string, payment?: string): AdmitBlock {
  if (status === "confirmed") return { admit: true };
  if (status === "cancelled") {
    return {
      admit: false,
      tone: "err",
      code: "cancelled",
      message: "This application is cancelled, not confirmed.",
    };
  }
  if (status === "declined") {
    return {
      admit: false,
      tone: "err",
      code: "declined",
      message: "This application is declined, not confirmed.",
    };
  }
  if (payment === "awaiting") {
    return {
      admit: false,
      tone: "warn",
      code: "unpaid",
      message: "This application is pending, not confirmed. Payment has not been verified — send them to the help desk.",
    };
  }
  return {
    admit: false,
    tone: "warn",
    code: "in_review",
    message: `This application is ${status || "pending"}, not confirmed. Send them to the help desk.`,
  };
}

export type StampDecision =
  | { write: false; reason: "missing" }
  | { write: false; reason: "blocked"; block: Extract<AdmitBlock, { admit: false }> }
  | { write: false; reason: "already"; at: string; by: string | null }
  | { write: true; reason: "admitted"; next: Application };

/**
 * Pure half of an atomic check-in. The store applies `next` only when
 * `write` is true, and only if it still holds the row this decision saw —
 * two scanners must not both pass the "not yet" branch.
 */
export function decideStamp(current: Application | null, actor: string, now: string): StampDecision {
  if (!current) return { write: false, reason: "missing" };
  const block = admissionBlock(current.status, current.payment);
  if (!block.admit) return { write: false, reason: "blocked", block };
  if (current.checkedInAt) {
    return { write: false, reason: "already", at: current.checkedInAt, by: current.checkedInBy ?? null };
  }
  return {
    write: true,
    reason: "admitted",
    next: { ...current, checkedInAt: now, checkedInBy: actor },
  };
}

export type UndoDecision =
  | { write: false; reason: "missing" | "not_in" | "too_late" }
  | { write: true; reason: "undone"; next: Application; previousAt: string; previousBy: string | null };

/** Drops the stamp only inside the window. A late undo would rewrite history. */
export function decideUndo(current: Application | null, nowMs: number): UndoDecision {
  if (!current) return { write: false, reason: "missing" };
  if (!current.checkedInAt) return { write: false, reason: "not_in" };
  const age = nowMs - Date.parse(current.checkedInAt);
  if (!Number.isFinite(age) || age > UNDO_WINDOW_MS) return { write: false, reason: "too_late" };
  const previousAt = current.checkedInAt;
  const previousBy = current.checkedInBy ?? null;
  const next = { ...current };
  delete next.checkedInAt;
  delete next.checkedInBy;
  return { write: true, reason: "undone", next, previousAt, previousBy };
}

export type GateRecord = {
  email: string;
  name: string;
  enteredAt?: string | null;
  enteredBy?: string | null;
  undoneAt?: string;
  undoneBy?: string;
  previousEnteredAt?: string;
  previousEnteredBy?: string | null;
};

export type GateDecision =
  | { write: false; reason: "already"; at: string; by: string | null }
  | { write: true; reason: "entered"; next: GateRecord };

/** Fest entry, once. A record left behind by an undo has no enteredAt and may be stamped again. */
export function decideGate(prior: GateRecord | null, person: { email: string; name: string }, actor: string, now: string): GateDecision {
  if (prior?.enteredAt) return { write: false, reason: "already", at: prior.enteredAt, by: prior.enteredBy ?? null };
  return {
    write: true,
    reason: "entered",
    next: { email: person.email.toLowerCase(), name: person.name, enteredAt: now, enteredBy: actor },
  };
}

export function decideGateUndo(prior: GateRecord | null, actor: string, nowMs: number): 
  | { write: false; reason: "missing" | "not_in" | "too_late" }
  | { write: true; next: GateRecord; previousAt: string; previousBy: string | null } {
  if (!prior) return { write: false, reason: "missing" };
  if (!prior.enteredAt) return { write: false, reason: "not_in" };
  const age = nowMs - Date.parse(prior.enteredAt);
  if (!Number.isFinite(age) || age > UNDO_WINDOW_MS) return { write: false, reason: "too_late" };
  return {
    write: true,
    previousAt: prior.enteredAt,
    previousBy: prior.enteredBy ?? null,
    next: {
      ...prior,
      enteredAt: null,
      enteredBy: null,
      undoneAt: new Date(nowMs).toISOString(),
      undoneBy: actor,
      previousEnteredAt: prior.enteredAt,
      previousEnteredBy: prior.enteredBy ?? null,
    },
  };
}

/** Fields a scanner may show. Payment references stay off this shape. */
export function publicRegistration(a: Application) {
  return {
    eventId: a.eventId,
    eventName: a.eventName || eventNameFor(a.eventId),
    status: a.status,
    payment: a.payment,
    checkedInAt: a.checkedInAt ?? null,
    checkedInBy: a.checkedInBy ?? null,
    teamName: a.teamName ?? null,
    teamCode: a.teamCode ?? null,
    email: a.email,
    name: a.name,
    ticketId: a.ticketId,
    college: a.college ?? null,
    phone: a.phone ?? null,
  };
}
