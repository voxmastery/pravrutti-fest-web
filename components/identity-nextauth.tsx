"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { IdentityContext } from "@/lib/identity-context";
import { devImpersonatedEmailClient } from "@/lib/dev-identity";

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

  /* The server override alone isn't enough: /dashboard gates on this context,
     not on the API's answer, so both sides have to agree. Named "DEV …" so a
     glance at the account chip tells you this isn't a real session.

     Read in an effect, not during render: the cookie only exists in the
     browser, so reading it while rendering made the first client paint
     "signed in" against server HTML that said "signed out" — a hydration
     mismatch on every page with the nav. Starting null keeps both sides
     identical for the first paint; the override lands one tick later. */
  const [devAs, setDevAs] = useState<string | null>(null);
  useEffect(() => {
    setDevAs(devImpersonatedEmailClient());
  }, []);

  return (
    <IdentityContext.Provider
      value={{
        ready: devAs ? true : status !== "loading" && authEnabled !== null,
        authEnabled: !!authEnabled,
        signedIn: devAs ? true : status === "authenticated",
        name: devAs ? `DEV ${devAs}` : session?.user?.name ?? null,
        email: devAs ?? session?.user?.email?.toLowerCase() ?? null,
        image: devAs ? null : session?.user?.image ?? null,
        signIn: () => signIn("google", { callbackUrl: window.location.pathname }),
        signOut: () => signOut({ callbackUrl: "/" }),
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}
