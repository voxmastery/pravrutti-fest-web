"use client";

/**
 * TEMPORARY preview route — a way to see the Path B "application under review"
 * screen without opening real registration (which is gated to "upcoming").
 * Safe to delete once the review UX is signed off. No backend calls.
 */

import { useState } from "react";
import { ApplicationReviewCard, type ReviewResult } from "@/components/application-review-card";

const solo: ReviewResult = {
  eventName: "RC-X",
  queuePosition: 7,
  capacity: 100,
  name: "Asha Rao",
  fee: "Rs. 200/-",
  ticketId: "PRV-8F3K2Q",
  payment: "awaiting",
};

const team: ReviewResult = {
  eventName: "Respawn",
  queuePosition: 3,
  capacity: 30,
  name: "Vikram Iyer",
  fee: "Rs. 200/-",
  ticketId: "PRV-2Z9M7T",
  payment: "awaiting",
  teamName: "Null Pointers",
  teamCode: "RSPWN42XK",
};

const free: ReviewResult = {
  eventName: "Discoverize",
  queuePosition: 12,
  capacity: 80,
  name: "Meera Nair",
  fee: "Free",
  ticketId: "PRV-5Q1A8B",
  payment: "not_required",
};

function Panel({ title, result }: { title: string; result: ReviewResult }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-white/40 mb-2">{title}</p>
      <div className="rounded-2xl border border-white/10 bg-[#0f0f16] p-5">
        <ApplicationReviewCard
          result={result}
          copied={copied}
          onCopyCode={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] py-10 px-4">
      <div className="max-w-[440px] mx-auto space-y-8">
        <p className="text-white/70 text-sm">
          Preview — Path B &ldquo;application under review&rdquo; state (sample data).
        </p>
        <Panel title="Charged — verifying payment" result={solo} />
        <Panel title="Team lead — verifying payment" result={team} />
        <Panel title="Free / joiner — pending approval" result={free} />
      </div>
    </div>
  );
}
