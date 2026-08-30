import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { parseTicketPayload } from "@/lib/checkin";
import { applicationPath, readJsonByPath, putJson } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

// A real ticket payload is `${ticketId}|${eventId}|${email}` — a PRV-xxxxxxxx
// ticketId (~12 chars), a short event slug, and an email address (RFC 5321
// caps that at 254 chars) — so a well-formed scan is well under 200 chars
// end to end. This endpoint takes an HTTP body rather than a scanner's own
// decode, so it is not guaranteed scanner-clean input. Bound it generously
// above any real payload before it ever reaches the parser or a lookup.
const MAX_PAYLOAD_LENGTH = 300;

export async function POST(req: Request) {
  // Scanning admits someone to a paid event, so it is organiser-only.
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Only organisers can check people in.", 403);

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

  const path = applicationPath(parsed.eventId, parsed.email);
  const record = (await readJsonByPath(path)) as Application | null;

  // Checking the ticketId too means a QR rebuilt for another person's email
  // cannot admit them on someone else's record.
  if (!record || record.ticketId !== parsed.ticketId)
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
