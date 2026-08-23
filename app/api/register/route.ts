import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { createHash, randomBytes } from "crypto";
import { events, eventId, capacityFor, registrationOpen } from "@/lib/pravrutti-data";
import { Application, PAYMENTS_LIVE } from "@/lib/applications";
import { resolveEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function listAll(prefix: string) {
  const out: { pathname: string; url: string }[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: Awaited<ReturnType<typeof list>> = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) out.push({ pathname: b.pathname, url: b.url });
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

export async function readPrivate(url: string) {
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

/**
 * GET /api/register            -> { confirmed, pending, open }
 * GET /api/register?event=slug -> adds { going: [{ first, initials }] }
 *
 * Only first names and initials ever leave the server.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("event");
  const blobs = await listAll("app/");

  const confirmed: Record<string, number> = {};
  const pending: Record<string, number> = {};
  const records = await Promise.all(blobs.map((b) => readPrivate(b.url)));

  const valid = records.filter(Boolean) as Application[];
  for (const r of valid) {
    if (r.status === "confirmed") confirmed[r.eventId] = (confirmed[r.eventId] ?? 0) + 1;
    else if (r.status === "pending") pending[r.eventId] = (pending[r.eventId] ?? 0) + 1;
  }

  const body: any = { confirmed, pending, open: registrationOpen() };

  if (slug) {
    body.going = valid
      .filter((r) => r.eventId === slug && r.status === "confirmed")
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      .slice(0, 24)
      .map((r) => {
        const parts = r.name.trim().split(/\s+/);
        return { first: parts[0], initials: (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() };
      });
  }

  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable. Refresh and try again." }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  // When signed in, the Google-verified address wins — nobody applies as
  // someone else, and the ticket always lands on an inbox they control.
  const verified = await resolveEmail();
  const email = (verified ?? String(body?.email ?? "")).trim().toLowerCase();
  const phone = String(body?.phone ?? "").replace(/[^\d+]/g, "");
  const college = String(body?.college ?? "").trim();
  const teamName = String(body?.teamName ?? "").trim();
  const members = String(body?.members ?? "").trim();
  const evId = String(body?.eventId ?? "").trim();

  const event = events.find((e) => eventId(e.name) === evId);
  if (!event) return NextResponse.json({ error: "That event doesn't exist." }, { status: 400 });
  if (!registrationOpen())
    return NextResponse.json({ error: "Applications closed on 4 October 2026." }, { status: 409 });
  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!/^\+?\d{10,13}$/.test(phone))
    return NextResponse.json({ error: "Enter a 10-digit phone number." }, { status: 400 });
  if (college.length < 2 || college.length > 120)
    return NextResponse.json({ error: "Enter your college name." }, { status: 400 });
  if (teamName.length > 80 || members.length > 400)
    return NextResponse.json({ error: "Team details are too long." }, { status: 400 });

  const isFree = event.fee.toLowerCase() === "free";
  const key = createHash("sha256").update(`${evId}:${email}`).digest("hex").slice(0, 24);
  const ticketId = `PRV-${randomBytes(4).toString("hex").toUpperCase()}`;

  const record: Application = {
    ticketId,
    eventId: evId,
    eventName: event.name,
    status: "pending",
    payment: isFree ? "not_required" : PAYMENTS_LIVE ? "paid" : "awaiting",
    fee: event.fee,
    name,
    email,
    phone,
    college,
    teamName: teamName || null,
    members: members || null,
    appliedAt: new Date().toISOString(),
  };

  try {
    await put(`app/${evId}/${key}.json`, JSON.stringify(record), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } catch (e: any) {
    if (/exists|overwrite/i.test(String(e?.message)))
      return NextResponse.json({ error: "You've already applied for this event." }, { status: 409 });
    console.error("application put failed", e);
    return NextResponse.json({ error: "Your application didn't save. Try again in a moment." }, { status: 500 });
  }

  const queue = (await listAll(`app/${evId}/`)).length;

  return NextResponse.json({
    ticketId,
    status: "pending",
    payment: record.payment,
    fee: event.fee,
    eventName: event.name,
    name,
    queuePosition: queue,
    capacity: capacityFor(evId),
  });
}
