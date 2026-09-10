import { NextResponse } from "next/server";
import { putJson } from "@/lib/blob-store";
import { randomBytes } from "crypto";
import { events, eventId } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const message = String(body?.message ?? "").trim();

  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  if (message.length < 5 || message.length > 2000)
    return NextResponse.json({ error: "Message must be 5–2000 characters" }, { status: 400 });

  /* Resolved against the events list rather than stored as sent, so the tag an
     organiser triages by cannot be an arbitrary string from the request. An
     unrecognised slug drops the tag instead of rejecting the message — losing
     someone's question over a bad slug would be the worse failure. */
  const slug = String(body?.eventId ?? "").trim().toLowerCase();
  const event = slug ? events.find((e) => eventId(e.name) === slug) : undefined;

  const record = {
    name,
    email,
    message,
    eventId: event ? eventId(event.name) : null,
    eventName: event?.name ?? null,
    sentAt: new Date().toISOString(),
  };
  await putJson(
    `contact/${Date.now()}-${randomBytes(3).toString("hex")}.json`,
    record,
    false
  );
  return NextResponse.json({ ok: true });
}
