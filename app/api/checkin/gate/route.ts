import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { parseTicketPayload } from "@/lib/checkin";
import { gatePath, listAll, readPrivate, readJsonByPath, putJson } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Same bound as /api/checkin — see the note there.
const MAX_PAYLOAD_LENGTH = 300;

/**
 * Gate entry: one scan at the fest entrance.
 *
 * The QR is per-registration (`ticketId|eventId|email`), so it names one
 * event — but it carries the person's email, and that is what we key on.
 * Scanning ANY of someone's tickets therefore surfaces every event they hold,
 * which is what an organiser on the door actually needs: who is this, and
 * what are they here for.
 *
 * It records fest entry only. A coordinator's per-event check-in is a
 * separate record and is not touched here, so being let through the gate is
 * never mistaken for having turned up to a particular event.
 */
export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser")
    return fail("Only organisers run the gate.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const raw = (body as { payload?: unknown } | null)?.payload;
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD_LENGTH)
    return fail("That QR isn't a Pravrutti ticket.", 400);

  const parsed = parseTicketPayload(raw);
  if (!parsed) return fail("That QR isn't a Pravrutti ticket.", 400);

  // Verify the scanned ticket is real before trusting the email inside it.
  // Without this, a hand-made QR carrying any address would list that
  // person's registrations to whoever printed it.
  const scanned = (await readJsonByPath(
    `app/${parsed.eventId}/${(await import("@/lib/blob-store")).emailScopedKey(parsed.eventId, parsed.email)}.json`
  )) as Application | null;
  if (!scanned || scanned.ticketId !== parsed.ticketId)
    return fail("That ticket doesn't match any registration.", 404);

  // Everything this person holds, across every event.
  const blobs = await listAll("app/");
  const all = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  const mine = all.filter(
    (a): a is Application => !!a && a.email?.toLowerCase() === parsed.email.toLowerCase()
  );

  const now = new Date().toISOString();
  const by = (await resolveEmail()) ?? "unknown";

  const prior = (await readJsonByPath(gatePath(parsed.email))) as
    | { enteredAt: string; enteredBy: string }
    | null;

  // Idempotent: a second scan reports when they first came in rather than
  // silently re-stamping, so a re-scan at a busy door tells the operator
  // something instead of looking identical to a first entry.
  if (!prior) {
    await putJson(
      gatePath(parsed.email),
      { email: parsed.email.toLowerCase(), name: scanned.name, enteredAt: now, enteredBy: by },
      true
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyEntered: !!prior,
    enteredAt: prior?.enteredAt ?? now,
    person: { name: scanned.name, college: scanned.college ?? null },
    /* eventName is denormalised onto the application, so an older or
       partial record may not carry it. Falling back to the id keeps one bad
       row from throwing the whole scan — the door is the worst place to
       discover a 500. */
    events: mine
      .map((a) => ({
        eventId: a.eventId,
        eventName: a.eventName || a.eventId,
        status: a.status,
        checkedInAt: a.checkedInAt ?? null,
      }))
      .sort((a, b) => String(a.eventName).localeCompare(String(b.eventName))),
  });
}
