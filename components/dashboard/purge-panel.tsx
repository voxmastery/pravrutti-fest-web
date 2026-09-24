"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Search, Trash2 } from "lucide-react";
import type { PurgePlan } from "@/lib/purge";

/**
 * Where an organiser removes test and demo accounts from the live data.
 *
 * Always two steps: Preview shows every record that would go, and only then
 * does Delete appear, behind typing DELETE. The server recomputes the plan on
 * delete and keeps a copy of everything it removes.
 */

const card = "rounded-xl border border-royal-wine bg-cosmic-purple/40";

const STARTER = ["roppashreeganesh@gmail.com", "fantasygamer.no.1@gmail.com", "ganesh.s0ga@gmail.com"].join("\n");

export function PurgePanel() {
  const [emails, setEmails] = useState(STARTER);
  const [plan, setPlan] = useState<PurgePlan | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function call(confirm: boolean) {
    setBusy(true);
    setError(null);
    if (!confirm) setDone(null);
    try {
      const res = await fetch("/api/admin/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, ...(confirm ? { confirm: "DELETE" } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.plan) setPlan(d.plan);
      if (!res.ok) setError(d?.error ?? "That didn't work. Try again.");
      else if (confirm) {
        setDone(`Removed ${d.deleted ?? 0} record${d.deleted === 1 ? "" : "s"}. A copy is saved at ${d.log ?? "the purge log"}.`);
        setPlan(null);
        setTyped("");
      }
    } catch {
      setError("Network dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const byEmail = new Map<string, PurgePlan["items"]>();
  for (const i of plan?.items ?? []) byEmail.set(i.email, [...(byEmail.get(i.email) ?? []), i]);
  const canDelete = !!plan && plan.items.length > 0 && plan.blockers.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-black tracking-wide text-champagne-gold">REMOVE TEST ACCOUNTS</h3>
        <p className="text-[13px] text-pearl-white/50 mt-1 leading-relaxed">
          Deletes every registration, team and check-in stored against these addresses, in every event, so they
          stop appearing in counts and lists. Use it only for test and demo accounts. A copy of everything removed
          is kept.
        </p>
      </div>

      <textarea
        value={emails}
        onChange={(e) => {
          setEmails(e.target.value);
          setPlan(null);
          setTyped("");
        }}
        rows={4}
        aria-label="Email addresses to remove, one per line"
        className="w-full rounded-lg border border-transparent bg-white/[0.08] px-3 py-2 text-sm text-pearl-white placeholder:text-pearl-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-pink/70"
        placeholder="one email per line"
      />

      <button
        type="button"
        disabled={busy || !emails.trim()}
        onClick={() => call(false)}
        className="h-10 px-4 rounded-lg border border-royal-wine bg-white/[0.06] text-sm text-pearl-white/85 inline-flex items-center gap-2 hover:bg-white/[0.12] disabled:opacity-50 cursor-pointer"
      >
        {busy && !typed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Preview what would be removed
      </button>

      {error && (
        <p className="rounded-lg border border-danger-strong/40 bg-danger-strong/10 px-3 py-2.5 text-[13px] text-danger">{error}</p>
      )}
      {done && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] text-success-soft">{done}</p>
      )}

      {plan && (
        <div className={`${card} p-4 space-y-3`}>
          {plan.blockers.map((b) => (
            <p key={b} className="flex gap-2 rounded-lg border border-soft-gold/40 bg-soft-gold/10 px-3 py-2 text-[13px] text-soft-gold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {b}
            </p>
          ))}
          {plan.notFound.length > 0 && (
            <p className="text-[13px] text-pearl-white/50">Nothing stored for: {plan.notFound.join(", ")}</p>
          )}
          {[...byEmail.entries()].map(([email, list]) => (
            <div key={email}>
              <p className="text-[13px] font-semibold text-pearl-white">{email}</p>
              <ul className="mt-1 space-y-0.5">
                {list.map((i) => (
                  <li key={i.path} className="text-[12px] text-pearl-white/60">
                    · {i.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {plan.items.length === 0 && plan.blockers.length === 0 && (
            <p className="text-[13px] text-pearl-white/50">Nothing to remove.</p>
          )}

          {canDelete && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-royal-wine/60">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm"
                className="flex-1 h-10 rounded-lg border border-transparent bg-white/[0.08] px-3 text-sm text-pearl-white placeholder:text-pearl-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/70"
              />
              <button
                type="button"
                disabled={busy || typed !== "DELETE"}
                onClick={() => call(true)}
                className="h-10 px-4 rounded-lg bg-danger-strong text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {busy && typed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete{" "}
                {plan.items.length} record{plan.items.length === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
