import { NextResponse } from "next/server";
import { resolveRole, resolveFacultyAccess } from "@/lib/roles";
import { events, eventId } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [role, faculty] = await Promise.all([resolveRole(), resolveFacultyAccess()]);

  const visible =
    role.kind === "organiser"
      ? events
      : role.kind === "coordinator"
      ? events.filter((e) => role.eventIds.includes(eventId(e.name)))
      : [];

  return NextResponse.json(
    {
      role: role.kind,
      /* Whether /faculty is open to them. Presentation only — the faculty
         route re-checks on every request. */
      faculty: faculty.allowed,
      events: visible.map((e) => ({ eventId: eventId(e.name), name: e.name })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
