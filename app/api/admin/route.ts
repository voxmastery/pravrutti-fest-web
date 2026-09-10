import { NextResponse } from "next/server";
import { listAll, readPrivate, readJsonByPath, putJson, applicationPath } from "@/lib/blob-store";
import { Application, AppStatus } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function readAll(prefix: string) {
  const blobs = await listAll(prefix);
  const out: any[] = [];
  const CHUNK = 20;
  for (let i = 0; i < blobs.length; i += CHUNK) {
    const batch = await Promise.all(blobs.slice(i, i + CHUNK).map((b) => readPrivate(b.url)));
    for (const r of batch) if (r) out.push(r);
  }
  return out;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [applications, contacts] = await Promise.all([readAll("app/"), readAll("contact/")]);
  applications.sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
  contacts.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  return NextResponse.json({ applications, contacts });
}

/**
 * POST /api/admin
 * { action: "confirm" | "decline" | "mark_paid", eventId, email }
 *
 * Declining an application refunds a paid fee — the refund itself is issued
 * through the gateway once one is connected; this records the intent and
 * timestamp so the desk has an auditable list.
 */
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body?.action ?? "");
  const evId = String(body?.eventId ?? "");
  const email = String(body?.email ?? "").toLowerCase();
  if (!["confirm", "decline", "mark_paid"].includes(action))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  // applicationPath owns the hashing, so the admin console and the rest of
  // the app can never disagree about where a record lives.
  const path = applicationPath(evId, email);
  const record: Application | null = await readJsonByPath(path);
  if (!record) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const now = new Date().toISOString();
  if (action === "mark_paid") {
    record.payment = "paid";
  } else {
    record.status = (action === "confirm" ? "confirmed" : "declined") as AppStatus;
    record.decidedAt = now;
    if (action === "decline" && (record.payment === "paid" || record.payment === "awaiting")) {
      record.payment = "refunded";
      record.refundedAt = now;
    }
  }

  await putJson(path, record, true);

  return NextResponse.json({ ok: true, application: record });
}
