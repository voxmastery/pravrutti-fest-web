import { NextResponse } from "next/server";
import { countsFor } from "@/lib/checkin-service";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await resolveRole();
  try {
    const result = await countsFor(role);
    return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Counts are unavailable." }, { status: 500 });
  }
}
