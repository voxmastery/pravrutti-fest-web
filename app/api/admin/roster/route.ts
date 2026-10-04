import { NextResponse } from "next/server";
import { buildEventRoster } from "@/lib/event-roster";
import { events, eventId as slugFor } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

/**
 * GET /api/admin/roster?eventId=…
 *
 * An event's roster built exactly as the dashboard builds it, once as an
 * organiser sees it and once as a coordinator does. For checking what a
 * coordinator is looking at without their session — a coordinator rang to
 * say they could see a team's lead and nobody else, and the organisers'
 * own view can't show that. Read-only.
 */
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = new URL(req.url).searchParams.get("eventId")?.trim() ?? "";
  if (!events.some((e) => slugFor(e.name) === eventId))
    return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  const [organiser, coordinator] = await Promise.all([
    buildEventRoster(eventId, "organiser"),
    buildEventRoster(eventId, "coordinator"),
  ]);
  return NextResponse.json({ eventId, organiser, coordinator }, { headers: { "cache-control": "no-store" } });
}
