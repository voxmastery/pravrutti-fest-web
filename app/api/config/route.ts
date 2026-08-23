import { NextResponse } from "next/server";
import { googleAuthEnabled } from "@/lib/auth";
import { clerkEnabled } from "@/lib/clerk-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the client know whether to show the Google button or the email fallback,
// without needing a rebuild when the credentials are added.
export async function GET() {
  return NextResponse.json({
    googleAuth: googleAuthEnabled || clerkEnabled,
    provider: clerkEnabled ? "clerk" : googleAuthEnabled ? "nextauth" : null,
  });
}
