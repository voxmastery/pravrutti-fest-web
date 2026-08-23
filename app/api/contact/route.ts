import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

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

  const record = { name, email, message, sentAt: new Date().toISOString() };
  await put(
    `contact/${Date.now()}-${randomBytes(3).toString("hex")}.json`,
    JSON.stringify(record),
    { access: "private", addRandomSuffix: false, contentType: "application/json" }
  );
  return NextResponse.json({ ok: true });
}
