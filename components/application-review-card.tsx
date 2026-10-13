"use client";

import { Button } from "@/components/ui/button";
import { Hourglass, Check, Copy } from "lucide-react";

/**
 * The "your application is under review" screen the applicant sees after
 * submitting (Path B).
 *
 * They have paid on the Juno portal and given us their registration ID; we
 * verify that payment automatically and email the ticket once it clears. This
 * screen's whole job is to make "nothing more to do" believable — so it states
 * what is happening, not what the applicant must do next.
 *
 * Extracted from the dialog so it can be rendered on its own (e.g. a preview
 * route) without standing up the whole registration flow, and so the wording
 * lives in one place.
 */

export type ReviewResult = {
  eventName: string;
  queuePosition: number;
  /** Null when the event has no stated cap. */
  capacity: number | null;
  name: string;
  fee: string;
  ticketId: string;
  payment: "not_required" | "awaiting" | "paid";
  teamName?: string | null;
  teamCode?: string | null;
  /* False when they paid but could not reach their transaction ID. There is
     then nothing to verify automatically against, and saying otherwise would
     promise them a confirmation that cannot arrive. */
  hasPaymentRef?: boolean;
  /* Set for Discoverize, whose entry is free and whose next step is the
      abstract rather than a payment. */
  abstractUrl?: string | null;
};

const card = "rounded-xl border border-white/[0.08] bg-white/[0.05]";
const ghostBtn =
  "h-[38px] rounded-2xl border border-transparent bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white cursor-pointer";
const primaryBtn =
  "w-full h-[38px] rounded-2xl bg-cyber-pink text-white hover:bg-electric-magenta font-medium text-base cursor-pointer";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-2 px-3 sm:px-4 py-3 min-w-0">
    <span className="text-[13px] text-white/50 shrink-0 pt-0.5">{label}</span>
    {children}
  </div>
);

function statusLabel(payment: ReviewResult["payment"], abstractUrl?: string | null): string {
  if (abstractUrl) return "Registered";
  if (payment === "awaiting") return "Verifying payment";
  if (payment === "paid") return "Payment received";
  return "Pending approval";
}

function explainer(r: ReviewResult): string {
  /* Discoverize: nothing was charged and nothing is being verified. The one
     thing standing between them and the presentation round is the abstract. */
  if (r.abstractUrl) {
    const team = r.teamCode ? " Share the team code — teammates can still join until the team is full." : "";
    return (
      "Your team is registered and there is nothing to pay. Submit your abstract to be considered for the presentation round — " +
      "only shortlisted teams pay the Rs. 200/- fee, and you can come back to this from My tickets." + team
    );
  }
  const base =
    r.payment === "not_required"
      ? "Nothing to pay for this one — you're in the queue. Your ticket and QR are emailed once organisers approve."
      : r.payment === "awaiting" && r.hasPaymentRef === false
      ? "You're registered. An organiser confirms your payment against the college's records — keep your receipt in case they ask for it, and your ticket and QR are emailed once it clears."
      : r.payment === "awaiting"
      ? "We're checking your Transaction Reference No against the college's statement. As soon as it clears, your ticket and QR are emailed to you — nothing more to do."
      : "Payment received. Your ticket and QR are emailed once your place is confirmed.";
  const team = r.teamCode ? " Share the team code — teammates can still join until the team is full." : "";
  return base + team;
}

export function ApplicationReviewCard({
  result,
  copied,
  onCopyCode,
  onClose,
}: {
  result: ReviewResult;
  copied: boolean;
  onCopyCode: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-4 py-1 animate-step overflow-hidden">
      <div className="flex flex-col items-center text-center pt-2 space-y-3 min-w-0">
        <span className="w-12 h-12 rounded-full bg-soft-gold/10 border border-soft-gold/25 flex items-center justify-center">
          <Hourglass className="w-5 h-5 text-champagne-gold" />
        </span>
        <div className="min-w-0 w-full px-1">
          <h2 className="font-semibold text-lg text-white break-words">Application under review</h2>
          <p className="text-[13px] text-white/50 mt-0.5 break-words">{result.eventName}</p>
        </div>
      </div>

      <div className={`${card} divide-y divide-white/[0.08] min-w-0 overflow-hidden`}>
        <Row label="Status">
          <span className="text-[13px] font-medium text-champagne-gold/90">{statusLabel(result.payment, result.abstractUrl)}</span>
        </Row>
        <Row label="Queue position">
          <span className="text-[13px] font-semibold text-white">
            #{result.queuePosition}
            {result.capacity ? ` of ${result.capacity}` : ""}
          </span>
        </Row>
        <Row label="Applicant">
          <span className="text-[13px] font-medium text-white min-w-0 max-w-[65%] break-words text-right">{result.name}</span>
        </Row>
        {result.teamName ? (
          <Row label="Team">
            <span className="text-[13px] font-medium text-white min-w-0 max-w-[65%] break-words text-right">{result.teamName}</span>
          </Row>
        ) : null}
        {result.teamCode ? (
          <Row label="Team code">
            <button
              type="button"
              onClick={() => onCopyCode(result.teamCode!)}
              className="inline-flex max-w-[65%] items-center gap-1.5 text-[13px] tracking-widest text-white/90 hover:text-white cursor-pointer break-all text-right"
              aria-label="Copy team code"
            >
              <span className="min-w-0 break-all">{result.teamCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
            </button>
          </Row>
        ) : null}
        <Row label="Fee">
          <span className="text-[13px] font-medium text-white">{result.fee}</span>
        </Row>
        <Row label="Reference">
          <span className="text-[13px] text-white/80 min-w-0 max-w-[65%] break-all text-right">{result.ticketId}</span>
        </Row>
      </div>

      <p className="text-[13px] text-white/55 leading-relaxed text-center px-2 break-words">{explainer(result)}</p>

      {/* The next step, right where they are looking. The same button waits
          for them in My tickets, because nobody submits an abstract in the
          thirty seconds after registering. */}
      {result.abstractUrl && (
        <a href={result.abstractUrl} target="_blank" rel="noopener noreferrer" className="block">
          <Button className={primaryBtn}>Submit abstract</Button>
        </a>
      )}

      <div className="flex gap-2">
        <a href="/ticket" className="flex-1">
          <Button variant="outline" className={`${ghostBtn} w-full`}>
            Track status
          </Button>
        </a>
        <Button onClick={onClose} className={`${primaryBtn} flex-1`}>
          Done
        </Button>
      </div>
    </div>
  );
}
