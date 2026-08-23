"use client";

import { SessionProvider } from "next-auth/react";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkIdentity } from "@/components/identity-clerk";
import { NextAuthIdentity } from "@/components/identity-nextauth";

/**
 * Exactly one auth backend mounts, decided by whether a Clerk publishable key
 * is present at build time. The rest of the app reads useIdentity() and never
 * knows which one it got.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (clerkKey) {
    return (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
        <ClerkIdentity>{children}</ClerkIdentity>
      </ClerkProvider>
    );
  }

  return (
    <SessionProvider>
      <NextAuthIdentity>{children}</NextAuthIdentity>
    </SessionProvider>
  );
}
