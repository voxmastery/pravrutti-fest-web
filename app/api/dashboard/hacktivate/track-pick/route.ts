import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { resolveRole } from "@/lib/roles";
import { canManageTrackPick, staffTitle } from "@/lib/track-pick";
import { actorFor, getStaffBoard, pausePicking, staffMove, staffUndo } from "@/lib/track-pick-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

async function staff() {
  const email = await resolveEmail();
  if (!email) return { error: NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore }) };
  const role = await resolveRole();
  if (!canManageTrackPick(role)) {
    return { error: NextResponse.json({ error: "Track Control is for Hacktivate organisers and coordinators." }, { status: 403, headers: noStore }) };
  }
  const actor = await actorFor(email);
  const kind = role.kind === "organiser" ? "organiser" : "coordinator";
  return { email, actor, kind, title: staffTitle(email, kind) };
}

export async function GET() {
  const who = await staff();
  if ("error" in who && who.error) return who.error;
  if (!("actor" in who)) return NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore });
  const board = await getStaffBoard();
  return NextResponse.json(
    { role: who.kind, actorName: who.actor.name, actorEmail: who.actor.email, title: who.title, ...board },
    { headers: noStore },
  );
}

export async function POST(req: Request) {
  const who = await staff();
  if ("error" in who && who.error) return who.error;
  if (!("actor" in who)) return NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore });

  let body: { action?: string; paused?: boolean; teamCode?: string; trackId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400, headers: noStore });
  }

  if (body.action === "pause") {
    const state = await pausePicking(who.actor, body.paused === true);
    const board = await getStaffBoard();
    return NextResponse.json(
      { ok: true, ...board, paused: state.paused, role: who.kind, actorName: who.actor.name, title: who.title },
      { headers: noStore },
    );
  }

  if (body.action === "undo") {
    const result = await staffUndo(who.actor, String(body.teamCode ?? ""), body.reason);
    if (!result.ok) {
      const message =
        result.code === "reason"
          ? "Write a short reason (at least 3 characters). It is stored with your name."
          : result.code === "not_picked"
            ? "That team has not picked a track."
            : "That override was not saved.";
      return NextResponse.json({ ok: false, code: result.code, error: message }, { status: 400, headers: noStore });
    }
    const board = await getStaffBoard();
    return NextResponse.json({ ok: true, ...board, role: who.kind, actorName: who.actor.name, title: who.title }, { headers: noStore });
  }

  if (body.action === "move") {
    const result = await staffMove(who.actor, String(body.teamCode ?? ""), String(body.trackId ?? ""), body.reason);
    if (!result.ok) {
      const message =
        result.code === "reason"
          ? "Write a short reason (at least 3 characters). It is stored with your name."
          : result.code === "full"
            ? "That track is full. Undo a team there first, or pick another track."
            : result.code === "same_track"
              ? "That team is already on this track."
              : result.code === "not_picked"
                ? "That team has not picked a track."
                : "That override was not saved.";
      return NextResponse.json({ ok: false, code: result.code, error: message }, { status: result.code === "full" ? 409 : 400, headers: noStore });
    }
    const board = await getStaffBoard();
    return NextResponse.json({ ok: true, ...board, role: who.kind, actorName: who.actor.name, title: who.title }, { headers: noStore });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: noStore });
}
