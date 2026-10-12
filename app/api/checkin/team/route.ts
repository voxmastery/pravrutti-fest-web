import { NextResponse } from "next/server";
import { teamSheet } from "@/lib/checkin-service";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role = await resolveRole();
  const url = new URL(req.url);
  try {
    const result = await teamSheet(role, url.searchParams.get("eventId") ?? "", url.searchParams.get("code") ?? "");
    return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The team list could not be loaded." }, { status: 500 });
  }
}
