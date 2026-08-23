"use client";

import { useState } from "react";
import { Event, eventId as slugify } from "@/lib/pravrutti-data";
import { COVER_GRADIENTS } from "@/components/event-detail-panel";

/**
 * Poster resolution, in order:
 *
 *   1. `event.poster` — an explicit path, when one event needs an odd filename
 *   2. `/posters/<slug>.png` — the convention; drop a file in and it appears
 *   3. a generated gradient cover — what every event gets until artwork exists
 *
 * Step 2 is why this is a client component: a missing file has to fail
 * gracefully to step 3 via onError rather than render a broken image, and
 * that can only be detected in the browser.
 */
export function EventPoster({
  event,
  name,
  className = "",
}: {
  event?: Event;
  name: string;
  className?: string;
}) {
  const src = event?.poster ?? `/posters/${slugify(name)}.png`;
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={`Poster for ${name}`}
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  const gradient = event ? COVER_GRADIENTS[event.category] : "from-[#721F4C] via-[#2B122C] to-[#0A0818]";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${gradient} flex items-center justify-center ${className}`}
      aria-label={`${name} cover`}
    >
      <div className="absolute inset-0 opacity-20 crt-scanlines pointer-events-none" />
      <span className="font-orbitron font-black text-[#F7EEE4]/90 text-lg tracking-wider">
        {initials}
      </span>
    </div>
  );
}
