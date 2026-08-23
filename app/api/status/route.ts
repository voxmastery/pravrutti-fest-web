import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { createHash } from "crypto";
import QRCode from "qrcode";
import { events, eventId } from "@/lib/pravrutti-data";
import { Application } from "@/lib/applications";
import { resolveEmail, authRequired } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      paths.slice(i, i + CHUNK).map(async (p) => {
        const res = await list({ prefix: p, limit: 1 });
        if (!res.blobs.length) return null;
        return readPrivate(res.blobs[0].url);
      })
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
      name: r.name,
      appliedAt: r.appliedAt,
      qr:
        r.status === "confirmed"
          ? await QRCode.toDataURL(`${r.ticketId}|${r.eventId}|${r.email}`, {
              margin: 1,
              width: 320,
              color: { dark: "#0A0512", light: "#F7EEE4" },
            })
          : null,
    }))
  );

  out.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  return NextResponse.json({ applications: out });
}
