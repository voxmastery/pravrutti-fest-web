import { NextResponse } from "next/server";
import { resolveEmail } from "@/lib/identity";
import { DOCS_COPY, HACKTIVATE_DOC_MAX_BYTES } from "@/lib/hacktivate-docs";
import {
  deleteParticipantPdf,
  getParticipantDocs,
  uploadParticipantPdf,
} from "@/lib/hacktivate-docs-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });
  const state = await getParticipantDocs(email);
  return NextResponse.json(state, { headers: noStore });
}

export async function POST(req: Request) {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload wasn't readable." }, { status: 400, headers: noStore });
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: DOCS_COPY.badType }, { status: 400, headers: noStore });
  }

  const blob = file as File;
  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.length > HACKTIVATE_DOC_MAX_BYTES) {
    return NextResponse.json({ error: DOCS_COPY.tooLarge }, { status: 400, headers: noStore });
  }

  const result = await uploadParticipantPdf(email, {
    fileName: blob.name || String(form.get("fileName") ?? "schematic.pdf"),
    bytes: buf,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.message, ...result.state },
      { status: result.status, headers: noStore },
    );
  }

  return NextResponse.json({ ok: true, doc: result.doc, ...result.state }, { headers: noStore });
}

export async function DELETE(req: Request) {
  const email = await resolveEmail();
  if (!email) return NextResponse.json({ error: DOCS_COPY.signIn }, { status: 401, headers: noStore });

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400, headers: noStore });
  }

  const result = await deleteParticipantPdf(email, String(body?.id ?? ""));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.message, ...result.state },
      { status: result.status, headers: noStore },
    );
  }
  return NextResponse.json({ ok: true, ...result.state }, { headers: noStore });
}
