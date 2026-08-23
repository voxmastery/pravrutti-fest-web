import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16 calls this the proxy (formerly middleware).
 * Clerk needs its handler in the request path to hydrate auth state.
 * When Clerk isn't configured this is a no-op, so the site runs unchanged.
 */
const clerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export default async function middleware(req: NextRequest) {
  if (!clerkConfigured) return NextResponse.next();
  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  // No route is protected at the edge — pages decide for themselves, so a
  // signed-out visitor can still browse events and read the site.
  return clerkMiddleware()(req, {} as any);
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
