"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users } from "lucide-react";

/**
 * A shortlisted Discoverize lead who registered solo, naming the team they
 * will present with. Registration for the event is closed; this only calls
 * the create path that already refuses anyone who is not shortlisted.
 *
 * Name only. Their registration already has their own name, phone and
 * college, and the server reads those rather than asking again.
 */
export function DiscoverizeFormTeam({
  eventId,
  email,
  onCreated,
}: {
  eventId: string;
  email?: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const teamName = name.trim();
    if (teamName.length < 2) {
      setError("Enter a team name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          eventId,
          name: teamName,
          email: email ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the team.");
        setBusy(false);
        return;
      }
      onCreated();
    } catch {
      setError("Network dropped. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
        Create your team
      </p>
      <p className="text-[12px] leading-relaxed text-white/55">
        You&apos;re shortlisted. Name your team, then add teammates — up to 4 including you.
        Registration stays closed to everyone else.
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        maxLength={80}
        aria-label="Team name"
        className="h-10 rounded-xl border border-white/[0.12] bg-white/[0.04] text-sm text-white placeholder:text-white/30"
      />
      {error ? <p className="text-[12px] text-cyber-pink">{error}</p> : null}
      <Button
        type="button"
        onClick={submit}
        disabled={busy}
        className="h-10 w-full rounded-xl bg-cyber-pink text-sm font-medium text-white hover:bg-electric-magenta"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Users className="mr-1.5 h-4 w-4" /> Create team
          </>
        )}
      </Button>
    </div>
  );
}
