import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import { events, eventId, capacityInPeople, maxTeamsFor, FEST } from "@/lib/pravrutti-data";
import { venueFor } from "@/lib/event-venues";
import type { Application } from "@/lib/applications";
import { countRegistrationsByEvent } from "@/lib/registration-counts";

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

  /* Cancelled, declined and unpaid attempts are not registrations, and one
     team is not four registrations — see lib/registration-counts, which the
     public seat counter uses too so the two can never disagree. */
  const byEvent = countRegistrationsByEvent(apps.filter(Boolean) as Application[]);
  const EMPTY = {
    people: 0, teams: 0, confirmedPeople: 0, confirmedTeams: 0, checkedIn: 0, notArrived: 0,
  };

  const rows = events.map((e) => {
    const id = eventId(e.name);
    const t = byEvent.get(id) ?? EMPTY;
    const capacity = capacityInPeople(e);
    /* An event run in teams is full when its teams are, not when its heads
       are: AI Escape Room at 74 of 100 students is 24 of 25 teams, and only
       the second number tells you whether to extend it. */
    const capacityTeams = maxTeamsFor(e);
    const fill = capacityTeams
      ? Math.min(t.teams / capacityTeams, 1)
      : capacity
      ? Math.min(t.people / capacity, 1)
      : null;

    return {
      eventId: id,
      name: e.name,
      category: e.category,
      venue: venueFor(id),
      capacity,
      capacityTeams,
      /* What one entry in this field is. Solo-allowed events mix lone
         entrants with teams, so calling every entry a "team" there would be
         wrong on the screen even though the arithmetic is the same. */
      unit: !e.teamSize.soloAllowed && e.teamSize.max > 1 ? ("team" as const) : ("entry" as const),
      registered: t.people,
      teams: t.teams,
      confirmed: t.confirmedPeople,
      confirmedTeams: t.confirmedTeams,
      checkedIn: t.checkedIn,
      // Null rather than 0 when there's no cap, so the UI shows no bar
      // instead of drawing an empty one that reads as "nobody signed up".
      fill,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      registered: acc.registered + r.registered,
      teams: acc.teams + r.teams,
      confirmed: acc.confirmed + r.confirmed,
      confirmedTeams: acc.confirmedTeams + r.confirmedTeams,
      checkedIn: acc.checkedIn + r.checkedIn,
      capacity: acc.capacity + (r.capacity ?? 0),
    }),
    { registered: 0, teams: 0, confirmed: 0, confirmedTeams: 0, checkedIn: 0, capacity: 0 }
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
