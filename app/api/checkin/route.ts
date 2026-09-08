import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { parseTicketPayload } from "@/lib/checkin";
import { applicationPath, readJsonByPath, putJson } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

// A real ticket payload is `${ticketId}|${eventId}|${email}` — a PRV- prefix
// plus 8 or 16 hex chars, a short event slug, and an email address (RFC 5321
// caps that at 254 chars) — so a well-formed scan is well under 200 chars
// end to end. This endpoint takes an HTTP body rather than a scanner's own
// decode, so it is not guaranteed scanner-clean input. Bound it generously
// above any real payload before it ever reaches the parser or a lookup.
const MAX_PAYLOAD_LENGTH = 300;

export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind === "none") return fail("You can't check people in.", 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const raw = body?.payload;
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD_LENGTH) {
    return fail("That QR isn't a Pravrutti ticket.", 400);
  }

  const parsed = parseTicketPayload(raw);
  if (!parsed) return fail("That QR isn't a Pravrutti ticket.", 400);

  /* Which event is being admitted to.
     The scanner names it, rather than trusting the eventId inside the QR: a
     participant at the Robo Race desk may well hold up their Hackathon
     ticket, and the desk should say "you're not on this list" instead of
     silently admitting them to the wrong event. */
  const targetEventId =
    typeof body?.eventId === "string" && body.eventId ? body.eventId : parsed.eventId;

  // Scope is re-derived here, never taken from the client. A coordinator may
  // only admit to their own events; an organiser may admit to any.
  if (!canViewEvent(role, targetEventId))
    return fail("You don't run this event.", 403);

  const path = applicationPath(targetEventId, parsed.email);
  const record = (await readJsonByPath(path)) as Application | null;

  // No record for THIS event is the ordinary "wrong desk" case, so it has to
  // read as a clear no rather than an error.
  if (!record) return fail("Not registered for this event.", 404);

  // Checking the ticketId too means a QR rebuilt for another person's email
  // cannot admit them on someone else's record. Only meaningful when the
  // scanned ticket is for this same event.
  if (targetEventId === parsed.eventId && record.ticketId !== parsed.ticketId)
    return fail("No ticket found for this event.", 404);

  if (record.status !== "confirmed")
    return fail(`This application is ${record.status}, not confirmed.`, 409);

  if (record.checkedInAt) {
    return NextResponse.json({
      ok: true,
      alreadyCheckedIn: true,
      name: record.name,
      eventName: record.eventName,
      at: record.checkedInAt,
      by: record.checkedInBy ?? null,
    });
  }

  const at = new Date().toISOString();
  const by = (await resolveEmail()) ?? "unknown";
  await putJson(path, { ...record, checkedInAt: at, checkedInBy: by }, true);

  return NextResponse.json({
    ok: true,
    alreadyCheckedIn: false,
    name: record.name,
    eventName: record.eventName,
    at,
  });
}
