import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import { events, eventId, capacityInPeople, FEST } from "@/lib/pravrutti-data";
import { venueFor } from "@/lib/event-venues";
import type { Application } from "@/lib/applications";
import { countsAsRegistered } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fest-wide overview: every event's numbers in one request.
 *
 * Organiser-only, because it is the whole fest by definition — a coordinator
 * has no business seeing another event's counts, and `/api/dashboard/event`
 * already serves the single-event case they need.
 *
 * Reads applications once and groups in memory rather than calling the
 * per-event endpoint 24 times. The previous dashboard could only show one
 * event at a time, so answering "how is the fest doing?" meant 24 round trips
 * and adding up by hand.
 *
 * Deliberately returns counts only — no names, no contact details. Nothing
 * here needs to identify a person, so nothing here does.
 */
export async function GET() {
  const role = await resolveRole();
  if (role.kind !== "organiser")
    return NextResponse.json({ error: "Organisers only." }, { status: 403 });

  const blobs = await listAll("app/");
  const apps = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];

  type Tally = { registered: number; confirmed: number; checkedIn: number };
  const byEvent = new Map<string, Tally>();

  for (const a of apps) {
    if (!a?.eventId) continue;
    /* Cancelled, declined and unpaid attempts are not registrations. Counting
       them inflated every fill figure and could show an event full while real
       places sat empty. */
    if (!countsAsRegistered(a)) continue;
    const t = byEvent.get(a.eventId) ?? { registered: 0, confirmed: 0, checkedIn: 0 };
    t.registered++;
    if (a.status === "confirmed") t.confirmed++;
    if (a.checkedInAt) t.checkedIn++;
    byEvent.set(a.eventId, t);
  }

  const rows = events.map((e) => {
    const id = eventId(e.name);
    const t = byEvent.get(id) ?? { registered: 0, confirmed: 0, checkedIn: 0 };
    const capacity = capacityInPeople(e);
    return {
      eventId: id,
      name: e.name,
      category: e.category,
      venue: venueFor(id),
      capacity,
      ...t,
      // Null rather than 0 when there's no cap, so the UI shows no bar
      // instead of drawing an empty one that reads as "nobody signed up".
      fill: capacity ? Math.min(t.registered / capacity, 1) : null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      registered: acc.registered + r.registered,
      confirmed: acc.confirmed + r.confirmed,
      checkedIn: acc.checkedIn + r.checkedIn,
      capacity: acc.capacity + (r.capacity ?? 0),
    }),
    { registered: 0, confirmed: 0, checkedIn: 0, capacity: 0 }
  );

  /* The headline question changes with the phase: before the fest an
     organiser is asking which events still need filling; during it they are
     asking who has actually turned up. Decided server-side so the client
     doesn't re-derive it from a clock that may be wrong. */
  const now = Date.now();
  const started = now >= Date.parse("2026-10-14T03:30:00Z");
  const ended = now > Date.parse("2026-10-16T12:30:00Z");
  const phase: "before" | "during" | "after" = ended ? "after" : started ? "during" : "before";

  return NextResponse.json({
    phase,
    registrationCloses: FEST.registrationCloses,
    totals,
    events: rows,
  });
}
