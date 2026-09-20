import { NextResponse } from "next/server";
import { readJsonByPath } from "@/lib/blob-store";
import { createHash } from "crypto";
import { events, eventId } from "@/lib/pravrutti-data";
import { venueFor } from "@/lib/event-venues";
import { Application } from "@/lib/applications";
import { resolveEmail, authRequired } from "@/lib/identity";
import { ticketQrDataUrl } from "@/lib/ticket-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/status
 *
 * Once Google sign-in is configured the email comes from the session only —
 * a signed-in person can see their own applications and nobody else's. Before
 * that, it falls back to the email in the body so the page still works.
 */
export async function POST(req: Request) {
  let email = "";

  if (authRequired()) {
    const signedIn = await resolveEmail();
    if (!signedIn)
      return NextResponse.json({ error: "Sign in to see your tickets." }, { status: 401 });
    email = signedIn;
  } else {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
    }
    email = String(body?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return NextResponse.json({ error: "Enter the email you applied with." }, { status: 400 });
  }

  const paths = events.map((e) => {
    const id = eventId(e.name);
    const key = createHash("sha256").update(`${id}:${email}`).digest("hex").slice(0, 24);
    return `app/${id}/${key}.json`;
  });

  const found: any[] = [];
  const CHUNK = 12;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const batch = await Promise.all(
      paths.slice(i, i + CHUNK).map((p) => readJsonByPath(p))
    );
    for (const r of batch) if (r) found.push(r as Application);
  }

  const out = await Promise.all(
    found.map(async (r: Application) => ({
      ticketId: r.ticketId,
      eventId: r.eventId,
      eventName: r.eventName,
      status: r.status,
      payment: r.payment,
      fee: r.fee,
      /* Whether a transaction ID was ever recorded, not what it is: the page
         only needs to know whether to offer to take one. */
      hasPaymentRef: Boolean((r as Application & { paymentRef?: string }).paymentRef),
      /* Left for the portal and never said how it went — the row still carries
         its intent mark. */
      unanswered: r.stage === "intent",
      /* Discoverize's rounds. Null for every other event, whose tickets read
         exactly as they did before. */
      round: r.round ?? null,
      name: r.name,
      teamName: r.teamName ?? null,
      teamCode: r.teamCode ?? null,
      appliedAt: r.appliedAt,
      /* The hall is server-only data (lib/event-venues.ts) and the ticket page
         is a client component, so it arrives here rather than from the events
         array. Confirmed only, matching the gate on /api/events/coordinators:
         someone still in review has not been told which room yet. */
      venue: r.status === "confirmed" ? venueFor(r.eventId) : null,
      qr: r.status === "confirmed" ? await ticketQrDataUrl(r) : null,
    }))
  );

  out.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  return NextResponse.json({ applications: out });
}
