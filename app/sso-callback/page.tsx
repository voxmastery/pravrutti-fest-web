"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Loaded only in the browser, and only when Clerk is configured — otherwise
// this route would break the build for a backend that isn't even in use.
const ClerkCallback = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.AuthenticateWithRedirectCallback })),
  { ssr: false }
);

/**
 * Clerk's callback handler renders nothing visible — it completes the OAuth
 * handshake and redirects. The spinner is ours, so the moment the user does
 * see still looks like the rest of the site.
 */
export default function SSOCallback() {
  const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <main className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-6 h-6 animate-spin text-[#D64D8D]" />
      <p className="font-sharetech text-xs uppercase tracking-widest text-[#F7EEE4]/50">
        Signing you in
      </p>
      {clerkConfigured && <ClerkCallback />}
    </main>
  );
}
