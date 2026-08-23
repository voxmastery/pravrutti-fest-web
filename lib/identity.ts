import { clerkEnabled } from "@/lib/clerk-config";
import { authOptions, googleAuthEnabled } from "@/lib/auth";

/**
 * Returns the verified email of whoever is signed in, or null.
 * API routes call this instead of touching either auth SDK directly, so
 * swapping backends never changes application logic.
 */
export async function resolveEmail(): Promise<string | null> {
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

/** True when some sign-in mechanism is configured at all. */
export const authRequired = () => clerkEnabled || googleAuthEnabled;
