import type { Application } from "@/lib/applications";
import {
  applicationPath,
  casUpdate,
  gatePath,
  listAll,
  listTeamMembers,
  putJson,
  readJsonByPath,
  readPrivate,
} from "@/lib/blob-store";
import {
  admissionBlock,
  decideGate,
  decideGateUndo,
  decideStamp,
  decideUndo,
  eventNameFor,
  parseTicketPayload,
  phoneDigits,
  publicRegistration,
  type GateRecord,
  type StampDecision,
  type UndoDecision,
} from "@/lib/checkin";
import {
  sqlAppsByEmail,
  sqlAppsByTicket,
  sqlCheckinCounts,
  sqlSearchApps,
} from "@/lib/app-index";
import { sqlEnabled } from "@/lib/sql-store";
import { canViewEvent, type Role } from "@/lib/roles";

export type ServiceResult = { status: number; body: Record<string, unknown> };

const invalid = (): ServiceResult => ({
  status: 400,
  body: { error: "That QR isn't a Pravrutti ticket.", code: "invalid", tone: "err" },
});

const unreadable = (): ServiceResult => ({
  status: 400,
  body: { error: "That request wasn't readable.", code: "invalid" },
});

const denied = (): ServiceResult => ({
  status: 403,
  body: { error: "You can't check people in.", code: "forbidden" },
});

const notYourEvent = (): ServiceResult => ({
  status: 403,
  body: { error: "You don't run this event.", code: "forbidden" },
});

const MAX_PAYLOAD = 300;
const MAX_BATCH = 12;

function notFound(message = "Not registered for this event."): ServiceResult {
  return { status: 404, body: { error: message, code: "not_found", tone: "err" } };
}

async function scanApps(): Promise<Application[]> {
  const blobs = await listAll("app/");
  const rows = await Promise.all(blobs.map((b) => readPrivate(b.url)));
  return rows.filter((a): a is Application => !!a && typeof (a as Application).email === "string");
}

async function appsByEmail(email: string): Promise<Application[]> {
  const who = email.toLowerCase();
  if (sqlEnabled()) {
    const rows = await sqlAppsByEmail(who);
    if (!rows) throw new Error("email lookup failed");
    return rows;
  }
  return (await scanApps()).filter((a) => a.email?.toLowerCase() === who);
}

async function appsByTicket(ticketId: string): Promise<Application[]> {
  if (sqlEnabled()) {
    const rows = await sqlAppsByTicket(ticketId);
    if (!rows) throw new Error("ticket lookup failed");
    return rows;
  }
  return (await scanApps()).filter((a) => a.ticketId === ticketId);
}

async function audit(entry: Record<string, unknown>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await putJson(`checkin-audit/${id}.json`, { ...entry, at: new Date().toISOString() }, true);
  } catch {
    /* The stamp is the record of admission. The log is the record of who undid it. */
  }
}

async function resolveTicket(parsed: { ticketId: string; eventId: string; email: string }) {
  const direct = (await readJsonByPath(applicationPath(parsed.eventId, parsed.email))) as Application | null;
  if (direct && direct.ticketId === parsed.ticketId && direct.eventId === parsed.eventId) {
    return { record: direct, duplicate: false, ticketMismatch: false };
  }
  const hits = (await appsByTicket(parsed.ticketId)).filter((a) => a.ticketId === parsed.ticketId);
  if (hits.length > 1) return { record: null, duplicate: true, ticketMismatch: false };
  if (hits.length === 1) return { record: hits[0], duplicate: false, ticketMismatch: false };
  return { record: null, duplicate: false, ticketMismatch: !!direct };
}

function admittedBody(record: Application, at: string, already: boolean, by?: string | null) {
  return {
    ok: true,
    alreadyCheckedIn: already,
    name: record.name,
    eventName: record.eventName || eventNameFor(record.eventId),
    eventId: record.eventId,
    email: record.email,
    ticketId: record.ticketId,
    teamName: record.teamName ?? null,
    teamCode: record.teamCode ?? null,
    college: record.college ?? null,
    at,
    ...(already ? { by: by ?? null } : {}),
  };
}

async function stamp(record: Application, actor: string): Promise<ServiceResult> {
  const path = applicationPath(record.eventId, record.email);
  const now = new Date().toISOString();
  const held: { decision: StampDecision } = { decision: { write: false, reason: "missing" } };
  await casUpdate<Application>(path, (current) => {
    const decision = decideStamp(current, actor, now);
    held.decision = decision;
    return { write: decision.write, next: decision.write ? decision.next : current };
  });
  const decision = held.decision;
  if (decision.reason === "missing") return notFound();
  if (decision.reason === "blocked") {
    return {
      status: 409,
      body: {
        ok: false,
        error: decision.block.message,
        code: decision.block.code,
        tone: decision.block.tone,
        name: record.name,
        eventName: record.eventName || eventNameFor(record.eventId),
        eventId: record.eventId,
        email: record.email,
      },
    };
  }
  if (decision.reason === "already") {
    return { status: 200, body: admittedBody(record, decision.at, true, decision.by) };
  }
  await audit({
    action: "checkin",
    eventId: record.eventId,
    email: record.email,
    ticketId: record.ticketId,
    name: record.name,
    actor,
  });
  return { status: 200, body: admittedBody(record, now, false) };
}

async function wrongEvent(record: Application, deskEventId: string): Promise<ServiceResult> {
  const regs = await appsByEmail(record.email);
  const events = (regs.length ? regs : [record]).map(publicRegistration);
  const ticketEventName = record.eventName || eventNameFor(record.eventId);
  const deskEventName = eventNameFor(deskEventId);
  return {
    status: 409,
    body: {
      ok: false,
      code: "wrong_event",
      tone: "err",
      error: `This ticket is for ${ticketEventName}, not ${deskEventName}.`,
      ticketEventId: record.eventId,
      ticketEventName,
      deskEventId,
      deskEventName,
      name: record.name,
      email: record.email,
      events,
    },
  };
}

async function checkInPayload(role: Role, raw: string, requestedEvent: string, actor: string): Promise<ServiceResult> {
  if (raw.length > MAX_PAYLOAD) return invalid();
  const parsed = parseTicketPayload(raw);
  if (!parsed) return invalid();
  const target = requestedEvent || parsed.eventId;
  if (!canViewEvent(role, target)) return notYourEvent();
  const resolved = await resolveTicket(parsed);
  if (resolved.duplicate) {
    return {
      status: 409,
      body: { ok: false, code: "duplicate", tone: "err", error: "That ticket id matches more than one registration." },
    };
  }
  if (!resolved.record) {
    if (parsed.eventId !== target) {
      return {
        status: 409,
        body: {
          ok: false,
          code: "wrong_event",
          tone: "err",
          error: `This ticket is for ${eventNameFor(parsed.eventId)}, not ${eventNameFor(target)}.`,
          ticketEventId: parsed.eventId,
          ticketEventName: eventNameFor(parsed.eventId),
          deskEventId: target,
          deskEventName: eventNameFor(target),
          events: [],
        },
      };
    }
    return notFound(resolved.ticketMismatch ? "No ticket found for this event." : "Not registered for this event.");
  }
  if (resolved.record.eventId !== target) return wrongEvent(resolved.record, target);
  return stamp(resolved.record, actor);
}

async function checkInIdentity(role: Role, eventId: string, email: string | undefined, ticketId: string | undefined, actor: string): Promise<ServiceResult> {
  if (!eventId) return { status: 400, body: { error: "Say which event this desk is.", code: "invalid" } };
  if (!canViewEvent(role, eventId)) return notYourEvent();
  let record = email
    ? ((await readJsonByPath(applicationPath(eventId, email))) as Application | null)
    : null;
  if ((!record || record.eventId !== eventId) && ticketId) {
    const hits = await appsByTicket(ticketId);
    record = hits.find((a) => a.eventId === eventId && a.ticketId === ticketId) ?? null;
  }
  if (!record || record.eventId !== eventId) return notFound();
  return stamp(record, actor);
}

export async function deskCheckIn(role: Role, body: unknown, actor: string): Promise<ServiceResult> {
  if (role.kind === "none") return denied();
  if (!body || typeof body !== "object") return unreadable();
  const bag = body as {
    payload?: unknown;
    eventId?: unknown;
    email?: unknown;
    ticketId?: unknown;
    emails?: unknown;
  };

  if (Array.isArray(bag.emails)) {
    const eventId = typeof bag.eventId === "string" ? bag.eventId : "";
    if (!eventId) return { status: 400, body: { error: "Say which event this desk is.", code: "invalid" } };
    if (!canViewEvent(role, eventId)) return notYourEvent();
    const emails = bag.emails.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0 || emails.length > MAX_BATCH) {
      return { status: 400, body: { error: "Pick between 1 and 12 people.", code: "invalid" } };
    }
    const results = [];
    for (const email of emails) {
      try {
        const one = await checkInIdentity(role, eventId, email, undefined, actor);
        results.push({ email, ...one.body, status: one.status });
      } catch {
        results.push({ email, ok: false, error: "Check-in could not be saved. Try that scan again.", status: 500 });
      }
    }
    return { status: 200, body: { ok: true, results } };
  }

  const eventId = typeof bag.eventId === "string" ? bag.eventId : "";
  if (typeof bag.payload === "string") return checkInPayload(role, bag.payload, eventId, actor);
  if (typeof bag.email === "string" || typeof bag.ticketId === "string") {
    return checkInIdentity(
      role,
      eventId,
      typeof bag.email === "string" ? bag.email.trim().toLowerCase() : undefined,
      typeof bag.ticketId === "string" ? bag.ticketId.trim() : undefined,
      actor
    );
  }
  return invalid();
}

export async function gateCheckIn(role: Role, body: unknown, actor: string): Promise<ServiceResult> {
  if (role.kind !== "organiser") {
    return { status: 403, body: { error: "Only organisers run the gate.", code: "forbidden" } };
  }
  if (!body || typeof body !== "object") return unreadable();
  const raw = (body as { payload?: unknown }).payload;
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD) return invalid();
  const parsed = parseTicketPayload(raw);
  if (!parsed) return invalid();

  const resolved = await resolveTicket(parsed);
  if (resolved.duplicate) {
    return {
      status: 409,
      body: { ok: false, code: "duplicate", tone: "err", error: "That ticket id matches more than one registration." },
    };
  }
  if (!resolved.record) {
    return { status: 404, body: { error: "That ticket doesn't match any registration.", code: "not_found", tone: "err" } };
  }

  const record = resolved.record;
  const regs = await appsByEmail(record.email);
  const events = (regs.length ? regs : [record])
    .map(publicRegistration)
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
  const person = { name: record.name, college: record.college ?? null, email: record.email };
  const block = admissionBlock(record.status, record.payment);
  if (!block.admit) {
    return {
      status: 409,
      body: {
        ok: false,
        code: block.code,
        tone: block.tone,
        error: block.message,
        person,
        events,
        scanned: publicRegistration(record),
      },
    };
  }

  const now = new Date().toISOString();
  const path = gatePath(record.email);
  let already = false;
  let at = now;
  let by: string | null = actor;
  await casUpdate<GateRecord>(path, (current) => {
    const decision = decideGate(current, person, actor, now);
    if (decision.reason === "already") {
      already = true;
      at = decision.at;
      by = decision.by;
    }
    return { write: decision.write, next: decision.write ? decision.next : current };
  });
  if (!already) {
    await audit({ action: "gate", email: record.email, ticketId: record.ticketId, name: record.name, actor });
  }
  return {
    status: 200,
    body: {
      ok: true,
      alreadyEntered: already,
      enteredAt: at,
      enteredBy: by,
      person,
      events,
      scanned: publicRegistration(record),
    },
  };
}

export async function undoCheckIn(role: Role, body: unknown, actor: string): Promise<ServiceResult> {
  if (role.kind === "none") return denied();
  if (!body || typeof body !== "object") return unreadable();
  const bag = body as { kind?: unknown; eventId?: unknown; email?: unknown };
  const email = typeof bag.email === "string" ? bag.email.trim().toLowerCase() : "";
  if (!email) return { status: 400, body: { error: "Say who to undo.", code: "invalid" } };

  if (bag.kind === "gate") {
    if (role.kind !== "organiser") {
      return { status: 403, body: { error: "Only organisers run the gate.", code: "forbidden" } };
    }
    const path = gatePath(email);
    const held: {
      blocked: "missing" | "not_in" | "too_late" | null;
      previousAt: string;
      previousBy: string | null;
    } = { blocked: "missing", previousAt: "", previousBy: null };
    await casUpdate<GateRecord>(path, (current) => {
      const decision = decideGateUndo(current, actor, Date.now());
      if (!decision.write) {
        held.blocked = decision.reason;
        return { write: false, next: current };
      }
      held.blocked = null;
      held.previousAt = decision.previousAt;
      held.previousBy = decision.previousBy;
      return { write: true, next: decision.next };
    });
    if (held.blocked) {
      const message =
        held.blocked === "too_late"
          ? "Undo is only available for 30 seconds."
          : "They are not checked in at the gate.";
      return { status: 409, body: { ok: false, error: message, code: held.blocked } };
    }
    await audit({
      action: "undo-gate",
      email,
      actor,
      previousAt: held.previousAt,
      previousBy: held.previousBy,
    });
    return { status: 200, body: { ok: true, undone: true } };
  }

  const eventId = typeof bag.eventId === "string" ? bag.eventId : "";
  if (!eventId) return { status: 400, body: { error: "Say which event to undo.", code: "invalid" } };
  if (!canViewEvent(role, eventId)) return notYourEvent();
  const path = applicationPath(eventId, email);
  const held: { decision: UndoDecision } = { decision: { write: false, reason: "missing" } };
  await casUpdate<Application>(path, (current) => {
    const decision = decideUndo(current, Date.now());
    held.decision = decision;
    return { write: decision.write, next: decision.write ? decision.next : current };
  });
  const decision = held.decision;
  if (!decision.write) {
    if (decision.reason === "missing") return notFound();
    const message =
      decision.reason === "too_late"
        ? "Undo is only available for 30 seconds."
        : "They are not checked in.";
    return { status: 409, body: { ok: false, error: message, code: decision.reason } };
  }
  await audit({
    action: "undo-desk",
    eventId,
    email,
    actor,
    previousAt: decision.previousAt,
    previousBy: decision.previousBy,
  });
  return { status: 200, body: { ok: true, undone: true } };
}

export async function searchPeople(role: Role, q: string): Promise<ServiceResult> {
  if (role.kind === "none") return denied();
  const query = q.trim();
  if (query.length < 2) return { status: 400, body: { error: "Type at least 2 characters.", code: "invalid" } };

  const email = query.includes("@") ? query.toLowerCase() : undefined;
  const ticketId = /^PRV-/i.test(query) ? query.toUpperCase() : undefined;
  const digits = phoneDigits(query);
  const phone = digits.length >= 10 ? digits.slice(-10) : undefined;
  const namePrefix = /[a-z]/i.test(query) && !email && !ticketId ? query : undefined;
  if (!email && !ticketId && !phone && !namePrefix) {
    return { status: 400, body: { error: "Search by name, phone, email, or ticket id.", code: "invalid" } };
  }

  let hits: Application[];
  if (sqlEnabled()) {
    const rows = await sqlSearchApps({ email, phone, ticketId, namePrefix, limit: 20 });
    if (!rows) throw new Error("search failed");
    hits = rows;
  } else {
    const all = await scanApps();
    const name = namePrefix?.toLowerCase();
    hits = all.filter((a) => {
      if (email && a.email?.toLowerCase() === email) return true;
      if (ticketId && a.ticketId?.toUpperCase() === ticketId) return true;
      if (phone && phoneDigits(a.phone).slice(-10) === phone) return true;
      if (name && a.name?.toLowerCase().startsWith(name)) return true;
      return false;
    });
  }

  if (role.kind === "coordinator") {
    const allowed = new Set(role.eventIds);
    hits = hits.filter((a) => allowed.has(a.eventId));
  }

  const seen = new Set<string>();
  const results = [];
  for (const hit of hits) {
    const key = `${hit.eventId}:${hit.email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(publicRegistration(hit));
    if (results.length >= 20) break;
  }
  return { status: 200, body: { ok: true, results } };
}

export async function teamSheet(role: Role, eventId: string, code: string): Promise<ServiceResult> {
  if (role.kind === "none") return denied();
  if (!eventId || !code) return { status: 400, body: { error: "Say which team.", code: "invalid" } };
  if (!canViewEvent(role, eventId)) return notYourEvent();
  const members = await listTeamMembers(eventId, code);
  const rows = [];
  for (const member of members) {
    const app = (await readJsonByPath(applicationPath(eventId, member.email))) as Application | null;
    rows.push({
      name: member.name,
      email: member.email,
      phone: member.phone ?? null,
      status: app?.status ?? "invited",
      checkedInAt: app?.checkedInAt ?? null,
      ticketId: app?.ticketId ?? null,
      canCheckIn: app?.status === "confirmed" && !app.checkedInAt,
    });
  }
  return { status: 200, body: { ok: true, eventId, teamCode: code, members: rows } };
}

export async function countsFor(role: Role): Promise<ServiceResult> {
  if (role.kind === "none") return denied();
  let gate = 0;
  let events: { eventId: string; confirmed: number; checkedIn: number }[] = [];

  if (sqlEnabled()) {
    const sql = await sqlCheckinCounts();
    if (!sql) throw new Error("counts failed");
    gate = sql.gate;
    events = sql.events;
  } else {
    const apps = await scanApps();
    const by = new Map<string, { eventId: string; confirmed: number; checkedIn: number }>();
    for (const app of apps) {
      if (!app.eventId) continue;
      const row = by.get(app.eventId) ?? { eventId: app.eventId, confirmed: 0, checkedIn: 0 };
      if (app.status === "confirmed") {
        row.confirmed += 1;
        if (app.checkedInAt) row.checkedIn += 1;
      }
      by.set(app.eventId, row);
    }
    events = [...by.values()];
    const gates = await listAll("gate/");
    for (const blob of gates) {
      const row = (await readPrivate(blob.url)) as GateRecord | null;
      if (row?.enteredAt) gate += 1;
    }
  }

  const allowed = role.kind === "coordinator" ? new Set(role.eventIds) : null;
  const visible = events
    .filter((e) => e.eventId && (!allowed || allowed.has(e.eventId)))
    .map((e) => ({ ...e, name: eventNameFor(e.eventId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    status: 200,
    body: { gate: role.kind === "organiser" ? gate : null, events: visible },
  };
}
