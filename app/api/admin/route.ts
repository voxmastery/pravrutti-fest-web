import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { createHash } from "crypto";
import { Application, AppStatus } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function readPrivate(url: string) {
  // Overwritten blobs can be served stale from the edge nearest the function,
  // so every read is cache-busted — a decision must never act on old state.
  const fresh = `${url}${url.includes("?") ? "&" : "?"}ts=${Date.now()}`;
  const res = await fetch(fresh, {
    headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function listAll(prefix: string) {
  const out: { pathname: string; url: string }[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: Awaited<ReturnType<typeof list>> = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) out.push({ pathname: b.pathname, url: b.url });
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
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

  const key = createHash("sha256").update(`${evId}:${email}`).digest("hex").slice(0, 24);
  const path = `app/${evId}/${key}.json`;
  const found = await list({ prefix: path, limit: 1 });
  if (!found.blobs.length) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const record: Application | null = await readPrivate(found.blobs[0].url);
  if (!record) return NextResponse.json({ error: "Application unreadable" }, { status: 500 });

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

  await put(path, JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });

  return NextResponse.json({ ok: true, application: record });
}
