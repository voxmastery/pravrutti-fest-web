"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { IdentityContext } from "@/lib/identity-context";

/** Mounted when Clerk isn't configured. Google creds may or may not be set. */
export function NextAuthIdentity({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.googleAuth))
      .catch(() => setAuthEnabled(false));
  }, []);

  return (
    <IdentityContext.Provider
      value={{
        ready: status !== "loading" && authEnabled !== null,
        authEnabled: !!authEnabled,
        signedIn: status === "authenticated",
        name: session?.user?.name ?? null,
        email: session?.user?.email?.toLowerCase() ?? null,
        image: session?.user?.image ?? null,
        signIn: () => signIn("google", { callbackUrl: window.location.pathname }),
        signOut: () => signOut({ callbackUrl: "/" }),
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}
