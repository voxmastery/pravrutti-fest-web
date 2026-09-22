"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamAddMember } from "@/components/team-add-member";
import type { TeamPreview } from "@/lib/teams";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";

/**
 * The lead's roster: who is on the team, and the button that adds the next one.
 *
 * Adding somebody holds their place immediately — the lead never waits on an
 * acceptance to carry on registering — so the roster is shown as places taken,
 * with "Invited" saying only that the person has not confirmed yet.
 *
 * Every invite exposes its link. Email delivery is not something this app can
 * promise (it needs SMTP configured, and mail lands in spam regardless), so the
 * lead can always copy the link and send it themselves.
 */
export function TeamRosterPanel({
  eventId,
  team,
  leadEmail,
  leadName,
  leadCollege,
  onTeam,
  cardCls,
  inputCls,
  ghostBtn,
  primaryBtn,
}: {
  eventId: string;
  team: TeamPreview;
  leadEmail: string;
  leadName: string;
  leadCollege: string;
  onTeam: (t: TeamPreview) => void;
  cardCls: string;
  inputCls: string;
  ghostBtn: string;
  primaryBtn: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Invite links minted this session, so each new invite can be copied. */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [mailWarning, setMailWarning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const roster = team.members ?? [];
  const full = roster.length >= team.maxMembers;

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data } as const;
  }

  async function removeMember(email: string) {
    setBusy(true);
    setError(null);
    const { ok, data } = await post({
      action: "remove_member",
      eventId,
      code: team.code,
      email: leadEmail,
      memberEmail: email,
    });
    if (!ok) setError(data?.error ?? "Couldn't remove them. Try again in a moment.");
    else if (data?.team) onTeam(data.team);
    setRemoving(null);
    setBusy(false);
  }

  async function copy(email: string) {
    const url = links[email];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFor(email);
      setTimeout(() => setCopiedFor((c) => (c === email ? null : c)), 1600);
    } catch {
      setError("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          Team members · {roster.length}/{team.maxMembers}
        </p>
      </div>

      <ul className="space-y-1.5">
        {roster.map((m) => {
          const isLead = m.email === leadEmail;
          const link = links[m.email];
          return (
            <li key={m.email} className="rounded-lg bg-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">{m.name}</span>
                {isLead ? (
                  <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/55">
                    You
                  </span>
                ) : (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      m.status === "joined"
                        ? "border border-emerald-400/40 text-emerald-300"
                        : "border border-white/20 text-white/50"
                    }`}
                  >
                    {m.status === "joined" ? "Joined" : "Invited"}
                  </span>
                )}
                {!isLead ? (
                  <button
                    type="button"
                    onClick={() => setRemoving(m.email)}
                    disabled={busy}
                    aria-label={`Remove ${m.name}`}
                    className="shrink-0 text-white/35 hover:text-danger-strong transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {link ? (
                <button
                  type="button"
                  onClick={() => copy(m.email)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/80 transition-colors cursor-pointer"
                >
                  {copiedFor === m.email ? (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3 h-3" aria-hidden="true" />
                  )}
                  {copiedFor === m.email ? "Invite link copied" : "Copy invite link"}
                </button>
              ) : null}

              {removing === m.email ? (
                <div className="mt-2 rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] p-2.5 space-y-2">
                  <p className="text-[12px] text-white/75 leading-relaxed">
                    Remove {m.name}? Their invite link stops working and their place
                    goes back to the team.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRemoving(null)}
                      className={`${ghostBtn} flex-1`}
                    >
                      Keep
                    </Button>
                    <Button
                      type="button"
                      onClick={() => removeMember(m.email)}
                      disabled={busy}
                      className="flex-1 h-[38px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium cursor-pointer"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {mailWarning ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2 text-[12px] text-white/75 leading-relaxed">
          {mailWarning}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] px-3 py-2 text-[12px] text-white/80">
          {error}
        </p>
      ) : null}

      <TeamAddMember
        eventId={eventId}
        code={team.code}
        leadEmail={leadEmail}
        leadName={leadName}
        leadCollege={leadCollege}
        full={full}
        maxMembers={team.maxMembers}
        onAdded={(next, invite) => {
          if (next) onTeam(next);
          if (invite.url) setLinks((l) => ({ ...l, [invite.email]: invite.url }));
          setMailWarning(
            invite.emailSent
              ? null
              : `We couldn't email ${invite.name}. Copy their invite link below and send it yourself.`,
          );
        }}
        cardCls={cardCls}
        inputCls={inputCls}
        ghostBtn={ghostBtn}
        primaryBtn={primaryBtn}
      />
    </div>
  );
}
