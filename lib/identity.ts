import { clerkEnabled } from "@/lib/clerk-config";
import { authOptions, googleAuthEnabled } from "@/lib/auth";
import { devImpersonatedEmail, devEmailFromCookieHeader, isDev } from "@/lib/dev-identity";
import { TEST_SITE } from "@/lib/test-site";

/**
 * Returns the verified email of whoever is signed in, or null.
 * API routes call this instead of touching either auth SDK directly, so
 * swapping backends never changes application logic.
 */
export async function resolveEmail(): Promise<string | null> {
  /* Local dev override. Compiled out of production builds — see dev-identity.ts.
     Env var first (set once at boot), then the cookie the demo buttons write,
     which is what lets you switch role without restarting. */
  if (isDev()) {
    const fromEnv = devImpersonatedEmail();
    if (fromEnv) return fromEnv;

    const { cookies } = await import("next/headers");
    const jar = await cookies().catch(() => null);
    const fromCookie = devEmailFromCookieHeader(
      jar
        ?.getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ")
    );
    if (fromCookie) return fromCookie;
  }

  if (clerkEnabled) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser().catch(() => null);
    const email =
      user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;
    return email ? email.toLowerCase() : null;
  }

  if (googleAuthEnabled) {
    const { getServerSession } = await import("next-auth");
    const session = await getServerSession(authOptions).catch(() => null);
    return session?.user?.email ? session.user.email.toLowerCase() : null;
  }

  return null;
}

/**
 * True when some sign-in mechanism is configured at all.
 *
 * The Vercel test site is the exception: its identity provider reports auth as
 * off so the flow is walkable as a guest, and if the server still demanded a
 * session the two would contradict each other — "Sign in to create or join a
 * team" on a site with no way to sign in, which blocks the 21 team-only events
 * outright. Unset on Hostinger, so real registration still requires Google.
 */
export const authRequired = () => !TEST_SITE && (clerkEnabled || googleAuthEnabled);
