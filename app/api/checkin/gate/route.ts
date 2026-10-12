import { NextResponse } from "next/server";
import { gateCheckIn } from "@/lib/checkin-service";
import { resolveEmail } from "@/lib/identity";
import { resolveRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fest entry. One scan names a ticket; the answer is who this person is
 * and every event they hold. Per-event admission is a separate desk action
 * so walking through the gate is not the same as turning up to Robo Race.
 */
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
    const result = await gateCheckIn(role, body, actor);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      { error: "The gate could not be saved. Try that scan again." },
      { status: 500 }
    );
  }
}
