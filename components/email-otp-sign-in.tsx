"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, Mail } from "lucide-react";

/**
 * The college-inbox path. Google stays the primary button; this is the
 * other way onto the same session, so a ticket registered to that address
 * is the one the page loads.
 */
export function EmailOtpSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    setBusy("send");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't send a code.");
        return;
      }
      setSentTo(email.trim().toLowerCase());
      setCode("");
      setNote(typeof data.message === "string" ? data.message : "Check your inbox for a 6-digit code.");
    } catch {
      setError("Network dropped. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy("verify");
    setError(null);
    try {
      const result = await signIn("email-otp", {
        email: sentTo ?? email,
        code,
        redirect: false,
        callbackUrl: window.location.pathname + window.location.search,
      });
      if (result?.error) {
        setError(cleanAuthError(result.error));
        return;
      }
      if (result?.ok === false) {
        setError("That code didn't work. Request a new one.");
        return;
      }
      onSignedIn?.();
    } catch {
      setError("Network dropped. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-[38px] rounded-2xl border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] font-medium text-[15px] cursor-pointer inline-flex items-center justify-center gap-2.5"
      >
        <Mail className="w-4 h-4" aria-hidden="true" /> Login with email OTP
      </button>
    );
  }

  return (
    <form
      className="space-y-3 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        if (sentTo) void verify();
        else void send();
      }}
    >
      <label className="block text-[12px] text-white/55" htmlFor="otp-email">
        Email you registered with
      </label>
      <input
        id="otp-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        disabled={!!sentTo || busy !== null}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full h-10 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyber-pink/70 disabled:opacity-70"
        placeholder="name@college.edu"
        required
      />
      {sentTo ? (
        <>
          <label className="block text-[12px] text-white/55" htmlFor="otp-code">
            6-digit code
          </label>
          <input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full h-10 rounded-xl border border-white/15 bg-black/30 px-3 text-center tracking-[0.4em] text-base text-white focus:outline-none focus:ring-2 focus:ring-cyber-pink/70"
            placeholder="••••••"
            required
          />
        </>
      ) : null}
      {error ? <p className="text-[12px] text-cyber-pink leading-snug">{error}</p> : null}
      {note && !error ? <p className="text-[12px] text-white/55 leading-snug">{note}</p> : null}
      <button
        type="submit"
        disabled={busy !== null || (sentTo ? code.length !== 6 : email.trim().length < 6)}
        className="w-full h-[38px] rounded-2xl bg-champagne-gold text-midnight-navy font-semibold text-sm cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
        {sentTo ? "Sign in" : "Email me a code"}
      </button>
      {sentTo ? (
        <button
          type="button"
          className="w-full text-[12px] text-white/45 hover:text-white/70 cursor-pointer"
          onClick={() => {
            setSentTo(null);
            setCode("");
            setNote(null);
            setError(null);
          }}
        >
          Use a different email
        </button>
      ) : (
        <button
          type="button"
          className="w-full text-[12px] text-white/45 hover:text-white/70 cursor-pointer"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Back
        </button>
      )}
    </form>
  );
}

function cleanAuthError(error: string): string {
  const text = decodeURIComponent(error.replace(/\+/g, " "));
  if (!text || text === "CredentialsSignin" || text === "Callback") {
    return "That code didn't work. Request a new one.";
  }
  return text;
}
