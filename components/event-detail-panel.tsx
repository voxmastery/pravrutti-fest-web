"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EventPoster } from "@/components/event-poster";
import { EventRegisterPanel } from "@/components/event-register-panel";
import { EventCoordinators } from "@/components/event-coordinators";
import { EventContactSheet } from "@/components/event-contact-sheet";
import { EventMoreSheet } from "@/components/event-more-sheet";
import {
  EventFormat,
  EventHostActions,
  EventHostLine,
  EventLocation,
  EventPresenter,
  EventStatusLine,
  EventWhenRow,
  SectionLabel,
} from "@/components/event-sections";
import { Event, eventId, formatINR, teamLabel, capacityLabel } from "@/lib/pravrutti-data";
import { COVER_GRADIENTS } from "@/lib/event-covers";
import { POSTER_TINTS } from "@/lib/poster-tints";
import { useCoordinatorPhones } from "@/hooks/use-coordinator-phones";
import { ArrowUpRight, ChevronsRight, Download } from "lucide-react";
import { EventDescription } from "@/components/event-description";

/** Re-exported because this is where it lived before it moved to lib. */
export { COVER_GRADIENTS };

/** 1st / 2nd / 3rd … as far as the event actually awards. */
const PLACES = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * The slide-over opened from the events grid.
 *
 * Renders the same section components, in the same order, as the full event
 * page — it is that page's phone layout in a panel. Every block it used to own
 * a private copy of (location, hosts, registration, format) now comes from the
 * shared components, because the copies had already drifted: this panel was
 * quoting a different seat count and loading posters from a .png path that has
 * never existed.
 */
export function EventDetailPanel({
  event,
  onClose,
}: {
  event: Event | null;
  onClose: () => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const id = event ? eventId(event.name) : "";
  // Asked for only while a panel is actually showing an event.
  const access = useCoordinatorPhones(id, Boolean(event));

  // Re-theme the page wash from THIS event's poster, the way Luma derives its
  // background from an event's cover. Category tinting gave eight events one
  // hue; the poster's own dominant colour makes each event distinct. Falls
  // back to the category tint when a poster has no extracted colour.
  useEffect(() => {
    if (!event) return;
    const root = document.documentElement;
    const tint = POSTER_TINTS[eventId(event.name)];

    if (tint) {
      const [r, g, b] = tint;
      const mix = (f: number) => [r, g, b].map((c) => Math.round(c * f)).join(", ");
      root.style.setProperty("--ambient-1", `${r}, ${g}, ${b}`);
      root.style.setProperty("--ambient-2", mix(0.7));
      root.style.setProperty("--ambient-3", mix(0.45));
      root.style.setProperty("--ambient-base", `rgb(${mix(0.16)})`);
    } else {
      root.setAttribute("data-ambient", event.category);
    }

    return () => {
      root.removeAttribute("data-ambient");
      for (const p of ["--ambient-1", "--ambient-2", "--ambient-3", "--ambient-base"]) {
        root.style.removeProperty(p);
      }
    };
  }, [event]);

  if (!event) return null;

  const formatRows = [
    { k: "Team size", v: teamLabel(event) },
    event.duration ? { k: "Duration", v: event.duration } : null,
    capacityLabel(event) ? { k: "Capacity", v: capacityLabel(event)! } : null,
    event.eligibility ? { k: "Eligibility", v: event.eligibility } : null,
  ].filter((r): r is { k: string; v: string } => r !== null);

  const showHostActions = access.registered;

  const contactAction = showHostActions ? (
    <button
      type="button" onClick={() => setContacting(true)}
      className="shrink-0 text-sm text-pearl-white/50 hover:text-champagne-gold transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
      Contact
    </button>
  ) : undefined;

  return (
    <>
      {/* The panel steps aside for anything it opens rather than stacking a
          second modal layer over itself: two nested focus traps is one too many
          on a phone, and the layer underneath cannot be read anyway. */}
      <Sheet
        open={!!event && !registering && !contacting && !moreOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <SheetContent
          side="right" className="w-full sm:max-w-[535px] bg-midnight-navy border-l-2 border-neon-purple text-pearl-white p-0 gap-0 overflow-y-auto overscroll-contain" >
          {/* Header bar — collapse, and a way out to the full page. */}
          <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 bg-midnight-navy/90 backdrop-blur-md border-b border-royal-wine">
            <button
              type="button" onClick={onClose}
              aria-label="Close panel" className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-pearl-white/60 hover:text-pearl-white hover:bg-cosmic-purple transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
              <ChevronsRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1 font-display text-sm font-bold text-pearl-white truncate">
              {event.name}
            </span>
            <Button
              asChild
              size="sm" variant="outline" className="h-11 shrink-0 rounded-xl border-royal-wine bg-cosmic-purple font-display text-[10px] font-bold uppercase tracking-widest text-pearl-white/85 hover:bg-deep-plum" >
              {/* No onClick closing the panel here. Clearing the event
                  unmounts this very <a> (the panel renders null without one)
                  in the same click, and the navigation goes with it — the
                  sheet slides shut and the page never changes. Nothing needs
                  closing anyway: routing to the event page unmounts the whole
                  events grid, panel included. */}
              <Link href={`/events/${id}`}>
                Event page <ArrowUpRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Same order as the event page on a phone. */}
          <div className="p-5 space-y-6">
            <div className="relative w-full max-w-[420px] mx-auto">
              <div
                aria-hidden="true" className={`absolute -inset-3 rounded-3xl bg-gradient-to-br ${COVER_GRADIENTS[event.category]} blur-2xl opacity-45`}
              />
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-royal-wine">
                <EventPoster event={event} name={event.name} className="absolute inset-0 w-full h-full" />
                <div className="absolute inset-0 opacity-20 crt-scanlines pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full font-display text-[10px] font-black uppercase tracking-widest bg-neon-purple/50 text-champagne-gold border border-royal-wine">
                  {event.category}
                </span>
                <span className="px-3 py-1 rounded-full font-display text-[10px] font-black uppercase tracking-widest bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/40">
                  {teamLabel(event)}
                </span>
              </div>
              <SheetTitle className="font-display text-2xl sm:text-3xl font-black tracking-wide text-pearl-white leading-[1.15] text-balance">
                {event.name}
              </SheetTitle>
              <p className="text-sm text-cyber-pink uppercase tracking-widest">
                {event.subCategory}
              </p>
            </div>

            <EventHostLine event={event} />
            <EventWhenRow event={event} onNavigate={onClose} />
            <EventStatusLine status={access.status} />

            <EventHostActions
              registered={showHostActions}
              confirmed={access.status === "confirmed"}
              ticketHref={`/ticket?event=${encodeURIComponent(id)}`}
              onContact={() => setContacting(true)}
              onMore={() => setMoreOpen(true)}
            />

            <EventRegisterPanel
              event={event}
              level={3}
              onRegisterOpenChange={setRegistering}
              onAccessRefresh={access.refresh}
              viewerStatus={access.status}
              viewerReady={access.ready}
            />

            <EventLocation access={access} level={3} />

            <EventCoordinators event={event} access={access} action={contactAction} level={3} />

            <section className="space-y-3">
              <SectionLabel level={3}>About this event</SectionLabel>
              <EventDescription description={event.description} className="text-sm text-pearl-white/80" />
            </section>

            <section className="space-y-3">
              <SectionLabel level={3}>Prizes</SectionLabel>
              {/* Some events award two places, some three — render exactly
                  as many as the event actually has. */}
              <div className={`grid gap-3 ${event.prizes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {event.prizes.map((amount, i) => (
                  <div key={i} className="p-3 rounded-xl border border-royal-wine bg-cosmic-purple text-center">
                    <span className="block text-[10px] uppercase tracking-widest text-pearl-white/40">
                      {PLACES[i]}
                    </span>
                    <span className="block font-display text-base font-black text-champagne-gold mt-1 tabular-nums">
                      {formatINR(amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <EventFormat rows={formatRows} level={3} />

            {event.brochureUrl ? (
              <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`} className="block">
                <Button
                  variant="outline" className="w-full h-12 rounded-xl border-royal-wine bg-cosmic-purple font-display text-xs font-bold uppercase tracking-widest text-champagne-gold hover:bg-deep-plum" >
                  <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Download the rulebook
                </Button>
              </a>
            ) : null}

            <EventPresenter level={3} />

            <div className="flex items-center gap-5 pt-2 pb-8 border-t border-royal-wine/60">
              <Link
                href="/faq" onClick={onClose}
                className="pt-3 text-sm text-pearl-white/50 hover:text-cyber-pink transition-colors" >
                FAQs
              </Link>
              <Link
                href="/schedule" onClick={onClose}
                className="pt-3 text-sm text-pearl-white/50 hover:text-cyber-pink transition-colors" >
                Schedule
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EventContactSheet event={contacting ? event : null} onClose={() => setContacting(false)} />
      <EventMoreSheet event={event} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
