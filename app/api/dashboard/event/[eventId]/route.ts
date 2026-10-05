import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { buildEventRoster } from "@/lib/event-roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return NextResponse.json(
    { eventId, ...(await buildEventRoster(eventId, role.kind === "organiser" ? "organiser" : "coordinator")) },
    { headers: { "cache-control": "no-store" } }
  );
}
