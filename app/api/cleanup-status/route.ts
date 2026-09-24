import { NextResponse } from "next/server";
import { demoCleanupStatus } from "@/lib/demo-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the one-time demo-account cleanup has run. Counts and times only. */
export async function GET() {
  const s = await demoCleanupStatus().catch(() => null);
  return NextResponse.json(
    s ? { state: s.state, finishedAt: s.finishedAt ?? null, deleted: s.deleted ?? null, keptForRealTeammates: s.keptForRealTeammates ?? null, failed: s.state === "failed" } : { state: "not-run" },
    { headers: { "cache-control": "no-store" } }
  );
}
