"use client";

import { useUser, useSignIn, useClerk } from "@clerk/nextjs";
import { IdentityContext } from "@/lib/identity-context";

/** Mounted only inside ClerkProvider. Drives Clerk headlessly — no Clerk UI. */
export function ClerkIdentity({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signIn } = useSignIn();
  const clerk = useClerk();

  return (
    <IdentityContext.Provider
      value={{
        ready: isLoaded,
        authEnabled: true,
        signedIn: !!isSignedIn,
        name: user?.fullName ?? null,
        email: user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null,
        image: user?.imageUrl ?? null,
        signIn: () => {
          if (!signIn) return;
          signIn.sso({
            strategy: "oauth_google",
            redirectUrl: window.location.pathname,
            redirectCallbackUrl: "/sso-callback",
          });
        },
        signOut: () => clerk.signOut({ redirectUrl: "/" }),
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}
