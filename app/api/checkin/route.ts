import { NextResponse } from "next/server";
import { deskCheckIn } from "@/lib/checkin-service";
import { resolveEmail } from "@/lib/identity";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await resolveRole();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const actor = (await resolveEmail()) ?? "unknown";
  try {
    const result = await deskCheckIn(role, body, actor);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      { error: "Check-in could not be saved. Try that scan again." },
      { status: 500 }
    );
  }
}
