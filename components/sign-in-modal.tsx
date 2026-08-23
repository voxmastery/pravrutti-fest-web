"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/lib/identity-context";
import { FEST } from "@/lib/pravrutti-data";
import { LogIn } from "lucide-react";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

/**
 * Luma's sign-in is a small centred card, not a full page: brand icon, a
 * welcome line, then the providers. We only have Google, so that is the only
 * row — rendering dead email/passkey options is exactly the problem this
 * replaces.
 */
export function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useIdentity();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[360px] rounded-2xl border border-white/[0.08] bg-[#141216]/95 backdrop-blur-xl text-white p-6 font-ui shadow-2xl shadow-black/60"
      >
        <div className="flex flex-col items-center text-center space-y-1.5">
          <span className="w-12 h-12 rounded-xl bg-[#721F4C]/40 border border-[#D64D8D]/40 flex items-center justify-center mb-1">
            <LogIn className="w-5 h-5 text-[#F2D2AE]" />
          </span>
          <DialogTitle className="font-ui font-semibold text-[22px] text-white">
            Welcome to {FEST.name}
          </DialogTitle>
          <DialogDescription className="font-ui text-[14px] text-white/55 leading-relaxed">
            Sign in to register for events and keep your tickets in one place.
          </DialogDescription>
        </div>

        <div className="pt-4">
          {me.authEnabled ? (
            <Button
              onClick={() => {
                me.signIn();
                onClose();
              }}
              className="w-full h-[38px] rounded-2xl bg-white text-black hover:bg-white/90 font-ui font-medium text-base cursor-pointer inline-flex items-center gap-2.5"
            >
              <GoogleMark /> Sign in with Google
            </Button>
          ) : (
            /* No auth backend configured — never render a button that would
               bounce the user into a NextAuth error page. */
            <Button
              disabled
              className="w-full h-[38px] rounded-2xl bg-white/10 text-white/40 font-ui font-medium text-base"
            >
              Sign-in setup pending
            </Button>
          )}
        </div>

        <p className="text-[12px] text-white/35 text-center leading-relaxed pt-1">
          {me.authEnabled
            ? "Your ticket stays tied to your Google inbox, so you can reopen it on any device."
            : "Sign-in isn't switched on yet. You can still browse events and register with your email."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
