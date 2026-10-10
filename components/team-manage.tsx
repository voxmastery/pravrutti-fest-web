"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamAddMember, type Invited } from "@/components/team-add-member";
import { cleanPersonName, type TeamPreview } from "@/lib/teams";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";

/**
 * The lead's controls for a team they already registered.
 *
 * These exist because two rules elsewhere depend on them. A lead cannot
 * withdraw while teammates are on the roster, and cannot delete a team that
 * still has people on it — both tell them to remove those people first. The
 * only place that could be done was the registration dialog, which a
 * registered lead can no longer reach, so both rules dead-ended.
 *
 * Remove and Make lead sit on the ticket, labeled. They used to live behind
 * a muted "Manage team" link, and leads (and the coordinators helping them)
 * reported they had no way to remove someone or change the lead — the
 * controls were there, one quiet tap down, and nobody found them. Make lead
 * is still only for a teammate who has joined, not one who was only invited.
 *
 * Adding somebody stays its own block, not folded into those rows. A lead
 * with a place still free needs it far more often than they need to remove
 * anyone. It follows canInvite: hidden when the server would refuse, which
 * includes a closed window only when this team is not already in. A full
 * roster keeps the button, disabled, so the lead can see why.
 *
 * Names are editable here too. The lead can correct anyone on the roster.
 * A member who is not the lead sees only their own name.
 */
export function TeamManage({
  eventId,
  team,
  viewerEmail,
  leadName,
  canAdd,
  onChanged,
}: {
  eventId: string;
  team: TeamPreview;
  /** The lead themselves — their own row is not removable here. */
  viewerEmail: string;
  /** Named in the invite email. The server falls back to their registration. */
  leadName?: string;
  /** False when this registration no longer holds a place — withdrawn or
      declined — so there is no team left to add anybody to. */
  canAdd: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The teammate the lead is about to hand the team to, awaiting a yes. */
  const [handingTo, setHandingTo] = useState<{ email: string; name: string } | null>(null);
  /** A member was added but the invite email did not go — not a failure, but
      the lead has to hand the link over themselves, so it cannot be silent. */
  const [mailWarning, setMailWarning] = useState<string | null>(null);
  /** Invite links minted this session, so a bounced email is not a dead end. */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** Remove waits for a yes. The button used to cancel the entry on the first tap. */
  const [removing, setRemoving] = useState<{ email: string; name: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function copyLink(email: string) {
    const url = links[email];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(email);
      window.setTimeout(() => setCopied((c) => (c === email ? null : c)), 1600);
    } catch {
      setError("Couldn't copy. Select the link and copy it manually.");
    }
  }

  const roster = team.members ?? [];

  async function call(body: Record<string, unknown>, tag: string): Promise<boolean> {
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
        return false;
      }
      setBusy(null);
      setConfirmDelete(false);
      setHandingTo(null);
      setRemoving(null);
      setConfirmLeave(false);
      onChanged();
      return true;
    } catch {
      setError("Network dropped. Try again.");
      setBusy(null);
      return false;
    }
  }

  function startEdit(email: string, name: string) {
    setEditingEmail(email);
    setDraft(name);
    setError(null);
  }

  async function saveName(email: string) {
    const name = cleanPersonName(draft);
    if (name.length < 2 || name.length > 80) {
      setError("Enter a name (2–80 characters).");
      return;
    }
    const ok = await call({ action: "rename_member", memberEmail: email, name }, `rename:${email}`);
    if (ok) setEditingEmail(null);
  }

  function editControl(person: { email: string; name: string }) {
    if (editingEmail === person.email) {
      return (
        <div className="space-y-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={80}
            aria-label={`New name for ${person.name}`}
            className="h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 text-sm text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveName(person.email)}
              disabled={busy !== null}
              className="inline-flex h-11 items-center rounded-xl bg-cyber-pink px-3 text-xs font-medium text-white hover:bg-electric-magenta cursor-pointer disabled:opacity-50"
            >
              {busy === `rename:${person.email}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                "Save"
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditingEmail(null)}
              disabled={busy !== null}
              className="h-11 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => startEdit(person.email, person.name)}
        disabled={busy !== null}
        aria-label={`Edit name for ${person.name}`}
        className="h-11 shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 hover:text-white cursor-pointer disabled:opacity-50"
      >
        Edit name
      </button>
    );
  }

  const me = viewerEmail.trim().toLowerCase();
  const selfPerson = roster.find((m) => m.email.toLowerCase() === me) ?? null;
  const errorBlock = error ? (
    <p className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] px-3 py-2 text-[12px] text-white/80">
      {error}
    </p>
  ) : null;

  if (!team.isLead) {
    if (!selfPerson) return null;
    return (
      <div className="mt-2 space-y-2">
        <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Your name</p>
          <ul className="space-y-1.5">
            <li className="rounded-lg bg-white/[0.05] px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">{selfPerson.name}</span>
                {editingEmail === selfPerson.email ? null : editControl(selfPerson)}
              </div>
              {editingEmail === selfPerson.email ? <div className="mt-2">{editControl(selfPerson)}</div> : null}
            </li>
          </ul>
        </div>
        {confirmLeave ? (
          <div className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] p-2.5 space-y-2">
            <p className="text-[12px] text-white/75 leading-relaxed">
              Leave {team.name}? Your entry for this event is cancelled, and you can join another team.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                disabled={busy !== null}
                className="h-11 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 cursor-pointer disabled:opacity-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => call({ action: "leave" }, "leave")}
                disabled={busy !== null}
                className="h-11 rounded-xl bg-danger-strong/80 px-3 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
              >
                {busy === "leave" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : "Leave team"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setConfirmLeave(true); setError(null); }}
            className="h-11 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 cursor-pointer"
          >
            Leave team
          </button>
        )}
        {errorBlock}
      </div>
    );
  }

  /* canInvite is the server's answer. canAdd is this registration still
     holding a place. A closed window keeps the button, disabled, with the
     reason — hiding it is what made leads think they had no way to add. */
  const inviting = canAdd && team.canInvite !== false;
  const blockedReason =
    canAdd && team.canInvite === false && !team.isFull
      ? team.inviteBlockedReason || "Registration closed. New members can't be added."
      : null;

  const addBlock = inviting ? (
    <TeamAddMember
      eventId={eventId}
      code={team.code}
      leadEmail={viewerEmail}
      leadName={leadName}
      full={team.isFull}
      maxMembers={team.maxMembers}
      onAdded={(_team, invite: Invited) => {
        if (invite.url) setLinks((l) => ({ ...l, [invite.email]: invite.url }));
        setMailWarning(
          invite.emailSent
            ? null
            : `We couldn't email ${invite.name}. Copy their invite link below and send it yourself.`,
        );
        onChanged();
      }}
      cardCls="rounded-xl border border-white/[0.1] bg-white/[0.03]"
      inputCls="h-10 rounded-xl border border-white/[0.12] bg-white/[0.04] text-sm text-white placeholder:text-white/30"
      ghostBtn="h-10 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm cursor-pointer"
      primaryBtn="h-10 rounded-xl bg-cyber-pink text-white hover:bg-electric-magenta font-medium text-sm cursor-pointer"
    />
  ) : blockedReason ? (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled
        className="h-11 w-full rounded-xl bg-white/[0.06] text-sm font-medium text-white/40 cursor-not-allowed"
      >
        Add a member
      </button>
      <p className="text-[12px] leading-relaxed text-white/55">{blockedReason}</p>
    </div>
  ) : null;

  const warningBlock = mailWarning ? (
    <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2 text-[12px] text-white/75 leading-relaxed">
      {mailWarning}
    </p>
  ) : null;

  /* Links for people added just now, wherever the panel happens to be. */
  const freshLinks = Object.keys(links);
  const linkBlock = freshLinks.length ? (
    <ul className="space-y-1">
      {freshLinks.map((email) => (
        <li key={email}>
          <button
            type="button"
            onClick={() => copyLink(email)}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/80 transition-colors cursor-pointer"
          >
            {copied === email ? (
              <Check className="w-3 h-3" aria-hidden="true" />
            ) : (
              <Copy className="w-3 h-3" aria-hidden="true" />
            )}
            {copied === email ? "Invite link copied" : `Copy ${email}'s invite link`}
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className="mt-2 space-y-2">
      {addBlock}
      {warningBlock}
      {linkBlock}
      {roster.length > 0 && (
        <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Remove or change lead
          </p>
          <ul className="space-y-1.5">
            {roster.map((m) => {
              const own = m.email.toLowerCase() === me;
              return (
              <li key={m.email} className="rounded-lg bg-white/[0.05] px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white">{m.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/35">
                    {m.status === "joined" ? "Joined" : "Invited"}
                  </span>
                </div>
                <details className="rounded-lg">
                  <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 [&::-webkit-details-marker]:hidden">
                    Actions for {m.name}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editingEmail === m.email ? null : editControl(m)}
                    {!own && m.status === "joined" ? (
                      <button
                        type="button"
                        onClick={() => { setHandingTo({ email: m.email, name: m.name }); setRemoving(null); setError(null); }}
                        disabled={busy !== null}
                        className="h-11 rounded-xl border border-champagne-gold/40 bg-champagne-gold/10 px-3 text-xs font-medium text-champagne-gold hover:bg-champagne-gold/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Make lead
                      </button>
                    ) : null}
                    {!own ? (
                      <button
                        type="button"
                        onClick={() => { setRemoving({ email: m.email, name: m.name }); setHandingTo(null); setError(null); }}
                        disabled={busy !== null}
                        aria-label={`Remove ${m.name}`}
                        className="inline-flex items-center gap-1.5 h-11 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 hover:border-danger-strong/50 hover:text-danger-strong transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </details>
                {editingEmail === m.email ? editControl(m) : null}
              </li>
              );
            })}
          </ul>

          {removing && (
            <div className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] p-2.5 space-y-2">
              <p className="text-[12px] text-white/75 leading-relaxed">
                Remove {removing.name} from {team.name}? Their entry for this event is cancelled, and they can join another team.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRemoving(null)}
                  disabled={busy !== null}
                  className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm px-4 cursor-pointer"
                >
                  Keep them
                </Button>
                <Button
                  type="button"
                  onClick={() => call({ action: "remove_member", memberEmail: removing.email }, removing.email)}
                  disabled={busy !== null}
                  className="h-[34px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium text-sm px-4 cursor-pointer"
                >
                  {busy === removing.email ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : `Remove ${removing.name}`}
                </Button>
              </div>
            </div>
          )}

          {handingTo && (
            <div className="rounded-lg border border-champagne-gold/30 bg-champagne-gold/[0.06] p-2.5 space-y-2">
              <p className="text-[12px] text-white/75 leading-relaxed">
                Make {handingTo.name} the lead of {team.name}? They&apos;ll manage the team from now on —
                adding and removing members. If you&apos;ve paid, your payment stays recorded against you; if
                you haven&apos;t paid yet, {handingTo.name} pays instead.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setHandingTo(null)}
                  disabled={busy !== null}
                  className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm px-4 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => call({ action: "transfer_lead", memberEmail: handingTo.email }, "lead")}
                  disabled={busy !== null}
                  className="h-[34px] rounded-2xl bg-cyber-pink text-white hover:bg-electric-magenta font-medium text-sm px-4 cursor-pointer"
                >
                  {busy === "lead" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : `Make ${handingTo.name} lead`}
                </Button>
              </div>
            </div>
          )}

          {/* Removing is what frees somebody, so say so where it is decided. */}
          <p className="text-[11px] text-white/35 leading-relaxed">
            Hand the team to a teammate before you can leave. Removing someone cancels their entry for this event.
          </p>
        </div>
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
