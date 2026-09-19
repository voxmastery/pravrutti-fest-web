import { NextResponse } from "next/server";
import { events, eventId } from "@/lib/pravrutti-data";
import { coordinatorPhones } from "@/lib/coordinator-phones";
import { venueFor } from "@/lib/event-venues";
import { resolveEventAccess } from "@/lib/event-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "cache-control": "no-store" } };

/**
 * GET /api/events/coordinators?event=<slug>
 *
 * Everything about one event that depends on who is asking:
 *
 *   - `contacts` — the coordinators' phone numbers. Public for any valid
 *                  slug so a visitor can call before registering. Still
 *                  served from this route rather than pravrutti-data.ts so
 *                  the numbers are not baked into the client bundle HTML.
 *   - `venue`    — the exact hall, rather than just the campus
 *   - `status`   — this viewer's own application, so the page can say where
 *                 they stand without a second round trip
 *   - `registered` — pending or confirmed for this event, or this event's
 *                    staff. Contact/More use this. It is not a phone unlock.
 *
 * The hall still goes only to people entitled to it: a participant the
 * organisers have confirmed, or the staff running the event. Everyone else
 * gets `{ unlocked: false }` and no venue. `contacts` are included either way.
 *
 * `status` and `registered` are deliberately outside the hall gate: they are
 * the viewer's own application (or a staff flag with no rooms attached) and
 * telling them "you are still in review" reveals nothing they did not submit
 * themselves. Serving them here rather than from /api/status saves the event
 * page a second request for one word.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("event") ?? "";
  const event = events.find((e) => eventId(e.name) === slug);
  if (!event) return NextResponse.json({ error: "No such event." }, { status: 404, ...NO_STORE });

  const access = await resolveEventAccess(slug);
  const contacts = coordinatorPhones(slug);

  if (!access.entitled) {
    return NextResponse.json({
      unlocked: false,
      registered: access.registered,
      reason: access.reason,
      status: access.status,
      awaitingReference: access.awaitingReference,
      contacts,
    }, NO_STORE);
  }

  return NextResponse.json({
    unlocked: true,
    registered: access.registered,
    status: access.status,
    awaitingReference: access.awaitingReference,
    venue: venueFor(slug),
    contacts,
  }, NO_STORE);
}
