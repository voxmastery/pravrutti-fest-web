import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { DOCS_COPY } from "@/lib/hacktivate-docs";
import {
  clearDemoLink,
  getParticipantDemo,
  submitDemoLink,
} from "@/lib/hacktivate-docs-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });
  const state = await getParticipantDemo(email);
  return NextResponse.json(state, { headers: noStore });
}

export async function POST(req: Request) {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });

  let body: { driveUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400, headers: noStore });
  }

  const result = await submitDemoLink(email, String(body?.driveUrl ?? ""));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.message, ...result.state },
      { status: result.status, headers: noStore },
    );
  }

  return NextResponse.json(
    { ok: true, message: DOCS_COPY.saved, demo: result.demo, ...result.state },
    { headers: noStore },
  );
}

export async function DELETE() {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });

  const result = await clearDemoLink(email);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.message, ...result.state },
      { status: result.status, headers: noStore },
    );
  }
  return NextResponse.json(
    { ok: true, message: DOCS_COPY.cleared, ...result.state },
    { headers: noStore },
  );
}
