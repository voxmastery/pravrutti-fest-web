"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

/**
 * Leaving a team from the team page.
 *
 * Confirmed rather than instant, because leaving is not reversible from this
 * side: the invite link burns with it, so getting back on takes the lead
 * adding you again. The confirmation says that plainly instead of asking
 * "are you sure?" and leaving the consequence to be guessed.
 */
export function TeamLeaveButton({
  eventId,
  code,
  token,
  memberName,
  teamName,
}: {
  eventId: string;
  code: string;
  token: string;
  memberName: string;
  teamName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "leave", eventId, code, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't leave the team. Try again in a moment.");
        setBusy(false);
        return;
      }
      setLeft(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (left)
    return (
      <p className="rounded-xl border border-royal-wine bg-cosmic-purple/60 px-4 py-3 text-sm text-pearl-white/70">
        You've left {teamName}. Your place has gone back to the team, and this
        invite link no longer works.
      </p>
    );

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-cyber-pink/40 bg-cyber-pink/10 px-4 py-3 text-sm text-pearl-white/80">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="rounded-xl border border-royal-wine bg-cosmic-purple/60 p-4 space-y-3">
          <p className="text-sm text-pearl-white/75 leading-relaxed">
            Leave {teamName}? Your place goes back to the team and this invite
            link stops working — {memberName ? `${memberName.split(/\s+/)[0]}, ` : ""}
            your lead would have to add you again.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={leave}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-cyber-pink px-4 py-2 font-display text-[11px] font-bold uppercase tracking-widest text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
              Yes, leave
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg border border-royal-wine px-4 py-2 font-display text-[11px] font-bold uppercase tracking-widest text-pearl-white/70 disabled:opacity-60"
            >
              Stay
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-royal-wine px-4 py-2.5 font-display text-[11px] font-bold uppercase tracking-widest text-pearl-white/60 hover:text-pearl-white hover:border-pearl-white/30 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          Leave this team
        </button>
      )}
    </div>
  );
}
