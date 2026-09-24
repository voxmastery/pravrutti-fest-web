import { NextResponse } from "next/server";
import { resolveFacultyAccess } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import { events, eventId } from "@/lib/pravrutti-data";
import { buildFacultyBoard } from "@/lib/faculty-board";
import type { Application } from "@/lib/applications";
import type { Team, TeamMember } from "@/lib/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

async function readAll<T>(prefix: string): Promise<(T | null)[]> {
  const rows = await listAll(prefix);
  return (await Promise.all(rows.map((b) => readPrivate(b.url)))) as (T | null)[];
}

/**
 * The faculty board. GET only — there is no POST, and nothing this route
 * resolves is a Role, so faculty access cannot reach any write path.
 */
export async function GET() {
  const who = await resolveFacultyAccess();
  if (!who.email) return fail("Sign in to view the faculty board.", 401);
  if (!who.allowed) return fail("This account doesn't have faculty access.", 403);

  const [applications, teams, members] = await Promise.all([
    readAll<Application>("app/"),
    readAll<Team>("team/"),
    readAll<{ code?: string; member?: TeamMember }>("team-member/"),
  ]);

  return NextResponse.json(
    {
      events: events.map((e) => ({ eventId: eventId(e.name), name: e.name })),
      teams: buildFacultyBoard(applications, teams, members),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
