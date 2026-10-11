import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { COPY } from "@/lib/track-pick";
import { claimTrack, getParticipantState } from "@/lib/track-pick-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: COPY.signIn }, { status: 401, headers: noStore });
  const state = await getParticipantState(email);
  return NextResponse.json(state, { headers: noStore });
}

export async function POST(req: Request) {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: COPY.signIn }, { status: 401, headers: noStore });

  let body: { trackId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400, headers: noStore });
  }

  const trackId = String(body?.trackId ?? "").trim();
  const result = await claimTrack(email, trackId);
  if (result.ok) {
    return NextResponse.json({ ok: true, idempotent: result.idempotent, ...result.state }, { headers: noStore });
  }
  return NextResponse.json(
    { ok: false, code: result.code, error: result.message, ...result.state },
    { status: result.status, headers: noStore },
  );
}
