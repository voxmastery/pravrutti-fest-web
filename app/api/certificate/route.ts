import { NextResponse } from "next/server";
import { certificateStatus, submitCertificateFeedback } from "@/lib/certificate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/** Whether the signed-in person may download, and whether their feedback is already in. */
export async function GET() {
  const result = await certificateStatus();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  return NextResponse.json({ eligible: result.eligible, submitted: result.submitted }, { headers: noStore });
}

/** Saves the feedback form once. A later submit does not change the row. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The feedback wasn't readable." }, { status: 400, headers: noStore });
  }
  const answers =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { answers?: unknown }).answers
      : undefined;
  const result = await submitCertificateFeedback(answers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  return NextResponse.json({ ok: true, already: result.already }, { headers: noStore });
}
