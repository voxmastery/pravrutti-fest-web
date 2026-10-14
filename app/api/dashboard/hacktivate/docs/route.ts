import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { resolveRole } from "@/lib/roles";
import { DOCS_COPY } from "@/lib/hacktivate-docs";
import { canManageTrackPick, knownStaffName, staffTitle } from "@/lib/track-pick";
import { getDocForDownload, getStaffDocsBoard } from "@/lib/hacktivate-docs-service";

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

export async function GET(req: Request) {
  const who = await staff();
  if ("error" in who && who.error) return who.error;
  if (!("email" in who)) return NextResponse.json({ error: "Sign in." }, { status: 401, headers: noStore });

  const url = new URL(req.url);
  const downloadId = url.searchParams.get("download");
  if (downloadId) {
    const teamCode = url.searchParams.get("team") ?? undefined;
    const result = await getDocForDownload(downloadId, teamCode ?? undefined);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status, headers: noStore });
    }
    const { record, bytes } = result;
    const safeName = record.fileName.replace(/[^\w.\- ()[\]]+/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...noStore,
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
        "content-length": String(bytes.length),
      },
    });
  }

  const board = await getStaffDocsBoard();
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
