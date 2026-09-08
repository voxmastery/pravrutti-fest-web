import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { roleForEmail } from "@/lib/roles";
import {
  emailFromSessionClaims,
  staffCockpitRedirect,
  staffEmailFromCookieHeader,
} from "@/lib/staff-cockpit";

/**
 * Next 16 calls this the proxy (formerly middleware).
 * Clerk needs its handler in the request path to hydrate auth state.
 * When Clerk isn't configured this is a no-op, so the site runs unchanged.
 *
 * Organisers are bounced off visitor marketing pages so the public hero
 * never paints for them. Coordinators keep `/events` and `/events/[slug]`
 * — they run an event they cannot apply to, and must still be able to
 * open that page. Visitors are never redirected.
 */
const clerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

function staffRedirect(req: NextRequest, extraEmail?: string | null) {
  const email =
    extraEmail || staffEmailFromCookieHeader(req.headers.get("cookie"));
  const to = staffCockpitRedirect(req.nextUrl.pathname, roleForEmail(email).kind);
  if (!to) return null;
  const url = req.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  return NextResponse.redirect(url);
}

export default async function middleware(req: NextRequest) {
  if (!clerkConfigured) {
    return staffRedirect(req) ?? NextResponse.next();
  }
  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  return clerkMiddleware(async (auth) => {
    const { sessionClaims } = await auth();
    const bounce = staffRedirect(req, emailFromSessionClaims(sessionClaims));
    if (bounce) return bounce;
  })(req, {} as any);
}

export const config = {
  matcher: [
    // Everything except static files and Next internals...
    "/((?!_next|favicon.ico|.*\\..*).*)",
    "/(api|trpc)(.*)",
    // ...plus Clerk's auto-proxy path, which its handshake needs.
    "/__clerk/:path*",
  ],
};
