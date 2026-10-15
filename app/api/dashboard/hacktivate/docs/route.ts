import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { resolveRole } from "@/lib/roles";
import { DOCS_COPY } from "@/lib/hacktivate-docs";
import { canManageTrackPick, knownStaffName, staffTitle } from "@/lib/track-pick";
import { getStaffDemoBoard } from "@/lib/hacktivate-docs-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

async function staff() {
  const email = await resolveEmail();
  if (!email) return { error: NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore }) };
  const role = await resolveRole();
  if (!canManageTrackPick(role)) {
    return {
      error: NextResponse.json({ error: DOCS_COPY.staffOnly }, { status: 403, headers: noStore }),
    };
  }
  const kind = role.kind === "organiser" ? "organiser" : "coordinator";
  const title = staffTitle(email, kind);
  const name = knownStaffName(email) ?? email;
  return { email, kind, title, name };
}

export async function GET() {
  const who = await staff();
  if ("error" in who && who.error) return who.error;
  if (!("email" in who)) return NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore });

  const board = await getStaffDemoBoard();
  return NextResponse.json(
    {
      role: who.kind,
      actorName: who.name,
      actorEmail: who.email,
      title: who.title,
      ...board,
    },
    { headers: noStore },
  );
}
