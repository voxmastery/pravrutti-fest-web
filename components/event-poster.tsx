"use client";

import { useState } from "react";
import { Event, eventId as slugify } from "@/lib/pravrutti-data";
import { COVER_GRADIENTS } from "@/lib/event-covers";

/**
 * Poster resolution, in order:
 *
 *   1. `event.poster` — an explicit path, when one event needs an odd filename
 *   2. `/posters/<slug>.webp` — the convention; drop a file in and it appears
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
  priority = false,
}: {
  event?: Event;
  name: string;
  className?: string;
  /** Set on the one poster that leads a page. Everything in a grid of 24
      stays lazy — the listing would otherwise fetch every poster at once. */
  priority?: boolean;
}) {
  const src = event?.poster ?? `/posters/${slugify(name)}.webp`;
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={`Poster for ${name}`}
        onError={() => setFailed(true)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        width={1080}
        height={1080}
        className={`object-cover ${className}`}
      />
    );
  }

  const gradient = event ? COVER_GRADIENTS[event.category] : "from-neon-purple via-deep-plum to-midnight-navy";
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
      <span className="font-display font-black text-pearl-white/90 text-lg tracking-wider">
        {initials}
      </span>
    </div>
  );
}
