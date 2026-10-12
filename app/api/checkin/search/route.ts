import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/checkin-service";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role = await resolveRole();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const result = await searchPeople(role, q);
    return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search failed. Try again." }, { status: 500 });
  }
}
