/**
 * Two auth backends can serve this site, chosen entirely by environment:
 *
 *   1. Clerk   — active when CLERK keys are present. Headless: every button is
 *                our own markup, no Clerk component renders anywhere visible.
 *   2. NextAuth — active when GOOGLE_CLIENT_ID/SECRET are present.
 *   3. Neither — the ticket page falls back to email lookup.
 *
 * Clerk wins when both are configured. Nothing else in the app knows or cares
 * which one is running: everything goes through resolveEmail() below.
 */
export const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
