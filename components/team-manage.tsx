"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TeamPreview } from "@/lib/teams";
import { Loader2, Trash2 } from "lucide-react";

/**
 * The lead's controls for a team they already registered.
 *
 * These exist because two rules elsewhere depend on them. A lead cannot
 * withdraw while teammates are on the roster, and cannot delete a team that
 * still has people on it — both tell them to remove those people first. The
 * only place that could be done was the registration dialog, which a
 * registered lead can no longer reach, so both rules dead-ended.
 *
 * Removing somebody cancels their application and frees them to join another
 * team, which is why it is offered plainly rather than buried: it is the one
 * action that gets a teammate unstuck.
 */
export function TeamManage({
  eventId,
  team,
  viewerEmail,
  onChanged,
}: {
  eventId: string;
  team: TeamPreview;
  /** The lead themselves — their own row is not removable here. */
  viewerEmail: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const roster = team.members ?? [];
  /* The lead's own row is not removable — leaving is withdrawing, which is a
     different action with its own warning about payment. */
  const others = roster.filter(
    (m) => m.email.toLowerCase() !== viewerEmail.trim().toLowerCase(),
  );

  async function call(body: Record<string, unknown>, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, code: team.code, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "That didn't work. Try again in a moment.");
        setBusy(null);
        return;
      }
      setBusy(null);
      setConfirmDelete(false);
      onChanged();
    } catch {
      setError("Network dropped. Try again.");
      setBusy(null);
    }
  }

  if (!team.isLead) return null;

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-white/35 hover:text-white/70 underline underline-offset-2 cursor-pointer"
      >
        Manage team
      </button>
    );

  return (
    <div className="mt-2 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40">Manage {team.name}</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setConfirmDelete(false); }}
          className="text-xs text-white/35 hover:text-white/70 cursor-pointer"
        >
          Done
        </button>
      </div>

      {others.length === 0 ? (
        <p className="text-[12px] text-white/45 leading-relaxed">
          Nobody else is on this team yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {others.map((m) => (
            <li key={m.email} className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-white">{m.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/35">
                {m.status === "joined" ? "Joined" : "Invited"}
              </span>
              <button
                type="button"
                onClick={() => call({ action: "remove_member", memberEmail: m.email }, m.email)}
                disabled={busy !== null}
                aria-label={`Remove ${m.name}`}
                className="shrink-0 text-white/35 hover:text-danger-strong transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy === m.email ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Removing is what frees somebody, so say so where it is decided. */}
      {others.length > 0 && (
        <p className="text-[11px] text-white/35 leading-relaxed">
          Removing someone cancels their entry for this event and lets them join another team.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] px-3 py-2 text-[12px] text-white/80">
          {error}
        </p>
      )}

      {confirmDelete ? (
        <div className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] p-2.5 space-y-2">
          <p className="text-[12px] text-white/75 leading-relaxed">
            Delete {team.name}? The code stops working. Your own registration stays —
            withdraw it separately if that is what you meant.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={busy !== null}
              className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm px-4 cursor-pointer"
            >
              Keep it
            </Button>
            <Button
              type="button"
              onClick={() => call({ action: "delete" }, "delete")}
              disabled={busy !== null}
              className="h-[34px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium text-sm px-4 cursor-pointer"
            >
              {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete team"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setConfirmDelete(true); setError(null); }}
          className="text-xs text-white/35 hover:text-danger-strong underline underline-offset-2 cursor-pointer"
        >
          Delete this team
        </button>
      )}
    </div>
  );
}
