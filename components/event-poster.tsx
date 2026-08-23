"use client";

import { Event } from "@/lib/pravrutti-data";
import { COVER_GRADIENTS } from "@/components/event-detail-panel";

/**
 * Every event needs a poster, and none of them have artwork yet. Until real
 * images land in `event.poster`, this renders a generated cover from the
 * event's category gradient — same treatment as the detail panel, so a list
 * and a panel never disagree about what an event looks like.
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
  if (event?.poster) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={event.poster}
        alt={`Poster for ${name}`}
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
