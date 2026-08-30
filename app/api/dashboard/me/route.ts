import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { events, eventId } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await resolveRole();

  const visible =
    role.kind === "organiser"
      ? events
      : role.kind === "coordinator"
      ? events.filter((e) => role.eventIds.includes(eventId(e.name)))
      : [];

  return NextResponse.json(
    {
      role: role.kind,
      events: visible.map((e) => ({ eventId: eventId(e.name), name: e.name })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
