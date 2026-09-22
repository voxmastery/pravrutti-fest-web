"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHONE_INPUT_MAX, phoneFieldValue } from "@/lib/applications";
import type { TeamPreview } from "@/lib/teams";
import { Loader2, UserPlus } from "lucide-react";

/**
 * The "add a member" button and the three fields behind it.
 *
 * Its own component because the lead needs it in two places that look nothing
 * alike: the registration dialog while they are still building the team, and
 * My Tickets once the team is registered and the dialog is out of reach. The
 * rule is the same in both — adding somebody holds their place immediately,
 * so the lead never waits on an acceptance — and so is the form, which is why
 * only the styling is passed in.
 *
 * Email delivery is not something this app can promise, so every add hands
 * back its invite link for the host to show.
 */

export type Invited = {
  name: string;
  email: string;
  /** The link to hand over when the email does not land. */
  url: string;
  emailSent: boolean;
};

export function TeamAddMember({
  eventId,
  code,
  leadEmail,
  leadName,
  leadCollege,
  full,
  maxMembers,
  onAdded,
  cardCls,
  inputCls,
  ghostBtn,
  primaryBtn,
}: {
  eventId: string;
  code: string;
  leadEmail: string;
  /** Named in the invite email. The server falls back to the lead's own
      registration where the host does not know it. */
  leadName?: string;
  /** Inherited by the member. Same fallback. */
  leadCollege?: string;
  full: boolean;
  maxMembers: number;
  onAdded: (team: TeamPreview | null, invite: Invited) => void;
  cardCls: string;
  inputCls: string;
  ghostBtn: string;
  primaryBtn: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "" });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_member",
          eventId,
          code,
          email: leadEmail,
          leadName,
          college: leadCollege,
          memberName: draft.name,
          memberEmail: draft.email,
          memberPhone: draft.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't add them. Try again in a moment.");
        setBusy(false);
        return;
      }
      onAdded(data?.team ?? null, {
        name: String(data?.invited?.name ?? draft.name),
        email: String(data?.invited?.email ?? draft.email).toLowerCase(),
        url: String(data?.inviteUrl ?? ""),
        emailSent: data?.emailSent !== false,
      });
      setDraft({ name: "", email: "", phone: "" });
      setOpen(false);
    } catch {
      setError("Network dropped. Try again.");
    }
    setBusy(false);
  }

  if (!open)
    return (
      <div className="space-y-2">
        {error ? <Problem>{error}</Problem> : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          disabled={full}
          className={`${ghostBtn} w-full`}
        >
          <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
          {full ? `Team is full (${maxMembers})` : "Add a member"}
        </Button>
      </div>
    );

  return (
    <div className={`${cardCls} p-3 space-y-2.5`}>
      <Input
        className={inputCls}
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder="Full name"
        aria-label="Teammate's full name"
      />
      <Input
        className={inputCls}
        type="email"
        value={draft.email}
        onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
        placeholder="Email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Teammate's email"
      />
      <Input
        className={inputCls}
        inputMode="numeric"
        value={draft.phone}
        onChange={(e) => setDraft((d) => ({ ...d, phone: phoneFieldValue(e.target.value) }))}
        placeholder="10-digit mobile"
        maxLength={PHONE_INPUT_MAX}
        aria-label="Teammate's mobile number"
      />
      <p className="text-[11px] text-white/40 leading-relaxed">
        We&apos;ll email them an invite. They hold their place straight away — you
        don&apos;t have to wait for them to accept.
      </p>
      {error ? <Problem>{error}</Problem> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={`${ghostBtn} px-4`}
        >
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={busy} className={`${primaryBtn} flex-1`}>
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding…
            </>
          ) : (
            "Add member"
          )}
        </Button>
      </div>
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] px-3 py-2 text-[12px] text-white/80">
      {children}
    </p>
  );
}
