import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The only shape a coordinator ever receives. No contact fields exist here,
    so widening the query alone cannot leak an email or phone. */
type RosterEntry = {
  name: string;
  college: string;
  status: Application["status"];
  checkedInAt: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const role = await resolveRole();
  // One generic message for both "no access" and "no such event" — a
  // different reply would confirm which events exist.
  if (!canViewEvent(role, eventId))
    return NextResponse.json({ error: "No access to this event." }, { status: 403 });

  // Scoped to this event's prefix, not every application in the fest.
  const blobs = await listAll(`app/${eventId}/`);
  const records = (await Promise.all(blobs.map((b) => readPrivate(b.url))))
    .filter(Boolean) as Application[];

  const mine = records.filter((r) => r.eventId === eventId);

  const roster: RosterEntry[] = mine
    .map((r) => ({
      name: r.name,
      college: r.college,
      status: r.status,
      checkedInAt: r.checkedInAt ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const confirmed = mine.filter((r) => r.status === "confirmed");
  const checkedIn = confirmed.filter((r) => r.checkedInAt);

  return NextResponse.json(
    {
      eventId,
      counts: {
        registered: mine.length,
        confirmed: confirmed.length,
        checkedIn: checkedIn.length,
        notArrived: confirmed.length - checkedIn.length,
      },
      roster,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
