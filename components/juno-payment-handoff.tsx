"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { JUNO_PAYMENT_URL, junoFields, junoFieldsText, type JunoApplicant } from "@/lib/juno";

/**
 * The bridge to the college's JUNO portal.
 *
 * The portal cannot be prefilled — see lib/juno.ts for why — so the applicant
 * has to type these four values into it themselves, on a phone, having already
 * typed them here. That retyping is where a mobile number picks up a digit and
 * stops matching the record we hold, which is the one thing that makes a
 * payment impossible to reconcile later. Handing the values over ready to copy
 * is the most of that risk we can remove from our side.
 */
export function JunoPaymentHandoff({ applicant, fee }: { applicant: JunoApplicant; fee: string }) {
  /* Keyed by label rather than a single boolean: four buttons sharing one
     "copied" flag all tick at once, which reads as "all four are on the
     clipboard" — the opposite of what happened. */
  const [copied, setCopied] = useState<string | null>(null);
  const fields = junoFields(applicant);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* Clipboard access is refused in some mobile browsers and over plain
         http. The values are on screen either way, so there is nothing to
         report — a failed copy leaves them to select the text by hand. */
    }
  };

  return (
    <div className="rounded-xl border border-soft-gold/20 bg-soft-gold/[0.05] p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Step 1 — pay {fee} on the college portal</p>
          <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
            The portal asks for these four things. Copy them across, then come back for the
            transaction ID.
          </p>
        </div>
        <Button
          asChild
          className="h-[34px] shrink-0 rounded-xl bg-cyber-pink text-white hover:bg-electric-magenta text-[13px] font-medium cursor-pointer px-3"
        >
          {/* noreferrer as well as noopener: the portal has no reason to be
              told which page sent the applicant to it. */}
          <a href={JUNO_PAYMENT_URL} target="_blank" rel="noopener noreferrer">
            Open portal <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </a>
        </Button>
      </div>

      <dl className="space-y-1">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5"
          >
            <dt className="text-[11px] uppercase tracking-wide text-white/40 w-[104px] shrink-0">
              {f.label}
            </dt>
            <dd className="text-[13px] text-white/90 truncate flex-1 min-w-0">{f.value}</dd>
            <button
              type="button"
              onClick={() => copy(f.label, f.value)}
              className="shrink-0 rounded-md p-1 text-white/45 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label={`Copy ${f.label.toLowerCase()}`}
            >
              {copied === f.label ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={() => copy("__all", junoFieldsText(applicant))}
        className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 cursor-pointer"
      >
        {copied === "__all" ? "All four copied" : "Copy all four"}
      </button>
    </div>
  );
}
