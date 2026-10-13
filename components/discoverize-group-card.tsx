"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

/**
 * The Discoverize team's WhatsApp group.
 *
 * Nothing about the invite is in this file. The link and the QR are asked for
 * at render time and only arrive if the server recognises the viewer as a
 * registered Discoverize team — so a curious reader of the JavaScript bundle
 * finds a fetch and an empty state, not a way into the group.
 *
 * It follows that the card cannot be drawn optimistically: until the answer
 * comes back there is nothing to draw, and a refusal draws nothing at all
 * rather than an error. Somebody who is not on the team should not even learn
 * that a group exists.
 */
export function DiscoverizeGroupCard({ compact = false }: { compact?: boolean }) {
  const [group, setGroup] = useState<{ url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(!compact);

  useEffect(() => {
    let alive = true;
    fetch("/api/discoverize/group", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.url) setGroup({ url: d.url, qr: d.qr }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!group) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(group.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Insecure context — the link is on screen and selectable anyway. */
    }
  };

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3 space-y-2.5">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true">
          <MessageCircle className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[13px] font-semibold text-white leading-snug break-words">
            Join the Discoverize WhatsApp group
          </p>
          <p className="text-[12px] text-white/60 leading-relaxed break-words">
            Every Discoverize update, including the presentation round, goes here first.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={group.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px]">
          <span className="flex h-10 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-400">
            Open in WhatsApp
          </span>
        </a>
        <button
          type="button"
          onClick={copy}
          className="h-10 shrink-0 rounded-xl border border-white/[0.14] bg-white/[0.05] px-3 text-sm text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
          aria-label="Copy the group invite link"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {/* On a phone the QR is the least useful half — you are already holding
          WhatsApp — so it folds away there and stays open on a ticket. */}
      {compact && !showQr && (
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="text-[12px] text-white/45 hover:text-white/80 underline underline-offset-2 cursor-pointer"
        >
          Show QR code
        </button>
      )}
      {showQr && (
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.qr}
            alt="QR code to join the Discoverize WhatsApp group"
            className="w-40 h-40 rounded-lg bg-white p-2"
          />
          <p className="text-[11px] text-white/40">Scan with the WhatsApp camera</p>
        </div>
      )}
    </div>
  );
}
