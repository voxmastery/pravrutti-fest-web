import { NextResponse } from "next/server";
import { requestEmailOtp } from "@/lib/email-otp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/**
 * Sends one sign-in code. The body is only an email address — a ticket,
 * a name, or any other message is not something this route can trigger.
 */
export async function POST(req: Request) {
  if (!sameSite(req)) {
    return NextResponse.json({ error: "Open the sign-in page and try again." }, { status: 403, headers: noStore });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400, headers: noStore });
  }
  const email = body && typeof body === "object" ? (body as { email?: unknown }).email : undefined;
  const result = await requestEmailOtp(email, clientIp(req));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  }
  return NextResponse.json(
    { ok: true, message: "If that inbox can receive mail, a 6-digit code is on its way. It expires in 10 minutes." },
    { headers: noStore },
  );
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip = first || req.headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}

function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
