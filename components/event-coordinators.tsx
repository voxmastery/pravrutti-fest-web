"use client";

import { Phone } from "lucide-react";
import { Event, clubFor } from "@/lib/pravrutti-data";
import type { CoordinatorPhones } from "@/hooks/use-coordinator-phones";
import { InitialsAvatar, SectionLabel } from "@/components/event-sections";

/**
 * The "Hosted By" block: the organising club, then the people running it.
 *
 * The call button appears whenever a number is present — visitors who have
 * not registered can still dial a coordinator. Numbers arrive from
 * /api/events/coordinators, not from pravrutti-data.ts.
 *
 * Until that lookup returns the row is just the name, with no placeholder and
 * no disabled button. The call control sits in the trailing flex slot and is
 * shorter than the 44px row it joins.
 *
 * The Contact action on the event page stays reserved for people already
 * registered for this event. Hall, More, and My Ticket are gated the same way.
 */
export function EventCoordinators({
  event,
  access,
  action,
  level = 2,
}: {
  event: Event;
  access: CoordinatorPhones;
  /** Right-aligned control on the section label — the "Contact" affordance. */
  action?: React.ReactNode;
  level?: 2 | 3;
}) {
  const club = clubFor(event);

  const people = [
    ...event.coordinators.faculty.map((c) => ({ ...c, role: "Faculty coordinator" })),
    ...event.coordinators.student.map((c) => ({ ...c, role: "Student coordinator" })),
  ];

  if (!club && people.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel level={level} action={action}>
        Hosted by
      </SectionLabel>

      <ul className="space-y-1">
        {club && (
          <li className="flex items-center gap-3 min-h-11 py-1.5">
            <InitialsAvatar name={club.name} org className="w-9 h-9 text-[10px]" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-champagne-gold break-words">{club.name}</p>
              <p className="text-xs text-pearl-white/45 break-words">{club.tagline}</p>
            </div>
          </li>
        )}

        {people.map((c) => {
          const phone = access.byName[c.name];
          return (
            <li key={c.name + c.role} className="flex items-center gap-3 min-h-11 py-1.5">
              <InitialsAvatar name={c.name} className="w-9 h-9 text-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-pearl-white break-words">{c.name}</p>
                <p className="text-xs text-pearl-white/45 break-words">{c.role}</p>
              </div>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  aria-label={`Call ${c.name} on ${phone}`}
                  className="shrink-0 w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-cyber-pink hover:text-champagne-gold hover:bg-neon-purple/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
                  <Phone className="w-4 h-4" aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
