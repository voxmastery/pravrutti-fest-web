"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, Share2, Trophy } from "lucide-react";
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
import { useCoordinatorPhones } from "@/hooks/use-coordinator-phones";
import { Event, FEST, formatINR, teamLabel, capacityLabel } from "@/lib/pravrutti-data";
import { COVER_GRADIENTS } from "@/lib/event-covers";
import { EventDescription } from "@/components/event-description";

/** 1st / 2nd / 3rd … as far as the event actually awards. */
const PLACES = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * The event page.
 *
 * On a phone this is one column in the order the Luma app uses — poster, title,
 * host, when, your status, then My Ticket/Contact/More (My Ticket only once
 * confirmed; Contact/More once registered), registration, location, hosts,
 * about, then the fest-specific detail. Most students open this on a phone, so
 * that order is the layout and the desktop grid is the variation.
 *
 * The two-column desktop layout is built by letting both wrappers collapse to
 * `display: contents` below `lg`, so their children become items of one flex
 * column and `order-*` puts them in reading order. Above `lg` the wrappers
 * become real boxes and the grid places them side by side. One DOM tree, so the
 * phone and the desktop can never show different content — only a different
 * arrangement of it.
 */
export function EventPageView({ event, slug }: { event: Event; slug: string }) {
  const access = useCoordinatorPhones(slug);
  const [contacting, setContacting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  /* The title folds into the sticky bar once it scrolls away, so the bar always
     says which event you are on. An observer rather than a scroll handler:
     reading the title's position on every frame is the layout thrash the
     performance guidance warns about. */
  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const share = useCallback(async () => {
    const url = `${window.location.origin}/events/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text: `Registrations are open for ${event.name}.`, url });
        return;
      } catch {
        /* dismissed — fall through to the clipboard, which always works */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [event.name, slug]);

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
      {/* Phone-only chrome. The site header and footer are hidden below lg on
          this route, so this bar is the way back and the way to share. */}
      <div className="lg:hidden sticky top-0 z-40 -mx-6 mb-5 px-2 h-14 flex items-center gap-1 bg-midnight-navy/90 backdrop-blur-md border-b border-royal-wine/60">
        <Link
          href="/events" aria-label="Back to all events" className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-pearl-white/70 hover:text-champagne-gold hover:bg-cosmic-purple transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <span
          aria-hidden="true" className={`min-w-0 flex-1 font-display text-sm font-bold text-pearl-white truncate transition-opacity duration-200 ${
            collapsed ? "opacity-100" : "opacity-0" }`}
        >
          {event.name}
        </span>
        <button
          type="button" onClick={share}
          aria-label={copied ? "Link copied" : "Share this event"}
          className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-pearl-white/70 hover:text-champagne-gold hover:bg-cosmic-purple transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
          {copied ? (
            <Check className="w-5 h-5 text-success-soft" aria-hidden="true" />
          ) : (
            <Share2 className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <Link
        href="/events" className="hidden lg:inline-flex items-center gap-2 mb-8 font-display text-xs uppercase tracking-widest text-pearl-white/50 hover:text-cyber-pink transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> All events
      </Link>

      <div className="flex flex-col min-w-0 gap-6 lg:grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-0 lg:items-start">
        {/* Left rail on desktop; scattered through the phone column by order. */}
        <div className="contents lg:block lg:sticky lg:top-28 lg:self-start lg:space-y-8">
          {/* Capped between phone and desktop widths: the single column is
              1052px wide at 768px, and a 700px square poster pushes every fact
              about the event below the fold. */}
          <div className="order-1 lg:order-none relative w-full max-w-[420px] mx-auto lg:max-w-none">
            <div
              aria-hidden="true" className={`absolute -inset-3 rounded-3xl bg-gradient-to-br ${COVER_GRADIENTS[event.category]} blur-2xl opacity-45`}
            />
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-royal-wine">
              <EventPoster event={event} name={event.name} priority className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 opacity-20 crt-scanlines pointer-events-none" />
            </div>
          </div>

          <div className="order-9 lg:order-none min-w-0">
            <EventCoordinators event={event} access={access} action={contactAction} />
          </div>

          <div className="order-[20] lg:order-none min-w-0">
            <EventPresenter />
          </div>
        </div>

        {/* Right column on desktop. */}
        <div className="contents lg:block lg:space-y-6">
          <div ref={titleRef} className="order-2 lg:order-none min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 max-w-full rounded-full font-display text-[10px] font-black uppercase tracking-widest bg-neon-purple/50 text-champagne-gold border border-royal-wine break-words">
                {event.category}
              </span>
              <span className="px-3 py-1 rounded-full font-display text-[10px] font-black uppercase tracking-widest bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/40">
                {teamLabel(event)}
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-wide text-pearl-white leading-[1.1] text-balance break-words">
              {event.name}
            </h1>
            <p className="text-sm text-cyber-pink uppercase tracking-widest break-words">{event.subCategory}</p>
          </div>

          <div className="order-3 lg:order-none min-w-0">
            <EventHostLine event={event} />
          </div>

          <div className="order-4 lg:order-none min-w-0">
            <EventWhenRow event={event} />
          </div>

          <EventStatusLine status={access.status} className="order-5 lg:order-none min-w-0" />

          <EventHostActions
            registered={showHostActions}
            confirmed={access.status === "confirmed"}
            ticketHref={`/ticket?event=${encodeURIComponent(slug)}`}
            onContact={() => setContacting(true)}
            onMore={() => setMoreOpen(true)}
            className="order-6 lg:order-none min-w-0" />

          <div className="order-7 lg:order-none min-w-0 empty:hidden">
            <EventRegisterPanel
              event={event}
              viewerStatus={access.status}
              awaitingReference={access.awaitingReference}
              unanswered={access.unanswered}
              /* The shortlist is a server-only view (withDiscoverizeShortlist).
                 The stored row still says payment "not_required" until the
                 lead acts on it, so the panel must be handed this view —
                 otherwise a shortlisted payer reads as a free entry, Pay
                 never appears, and ?finish=pay does nothing. */
              round={access.round}
              viewerPayment={access.payment}
              viewerReady={access.ready}
              onAccessRefresh={access.refresh}
              phones={access.byName}
            />
          </div>

          <div className="order-8 lg:order-none min-w-0">
            <EventLocation access={access} />
          </div>

          <section className="order-10 lg:order-none min-w-0 space-y-3">
            <SectionLabel>About this event</SectionLabel>
            <EventDescription description={event.description} className="text-pearl-white/75" />
          </section>

          <section
            className="order-11 lg:order-none min-w-0 space-y-3"
            hidden={event.prizes.length === 0}
          >
            <SectionLabel>Prizes</SectionLabel>
            {/* Prize count varies per event — render only what's awarded. */}
            <div className={`grid gap-3 ${event.prizes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {event.prizes.map((amount, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl bg-cosmic-purple/60 border text-center ${
                    i === 0 ? "text-champagne-gold border-soft-gold/40" : "text-pearl-white border-royal-wine" }`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-pearl-white/40">
                    {PLACES[i]}
                  </p>
                  <p className="font-display text-lg font-black mt-1 tabular-nums">{formatINR(amount)}</p>
                </div>
              ))}
            </div>
          </section>

          {event.sponsorPerks && (
            /* A sponsor's perks for this event's people (ElevenLabs on
               Hacktivate) — under the prizes, because that is what they are. */
            <section className="order-11 lg:order-none min-w-0 space-y-3">
              <SectionLabel>Partner perks</SectionLabel>
              <a
                href={event.sponsorPerks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-royal-wine bg-cosmic-purple/60 p-5 transition-colors hover:border-cyber-pink/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.sponsorPerks.logo}
                  alt={event.sponsorPerks.sponsor}
                  className="h-5 w-auto max-w-full object-contain object-left"
                />
                <ul className="mt-5 space-y-2 text-sm leading-relaxed text-pearl-white/75">
                  {event.sponsorPerks.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden="true" className="text-champagne-gold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </a>
            </section>
          )}

          <div className="order-12 lg:order-none min-w-0">
            <EventFormat rows={formatRows} />
          </div>

          <div className="order-[13] lg:order-none min-w-0 space-y-3">
            {/* No rulebook yet for this event — offering a button that goes
                nowhere is worse than not offering one. */}
            {event.brochureUrl ? (
              <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`} className="block">
                <Button
                  variant="outline" className="w-full h-12 rounded-xl border-royal-wine bg-cosmic-purple font-display text-xs font-bold uppercase tracking-widest text-champagne-gold hover:bg-deep-plum cursor-pointer" >
                  <Download className="w-4 h-4 mr-2" aria-hidden="true" /> Download the rulebook
                </Button>
              </a>
            ) : (
              <p className="rounded-xl border border-royal-wine bg-cosmic-purple/50 px-4 py-3 text-xs text-pearl-white/50 leading-relaxed">
                The rulebook for this event is still with its coordinators. Their numbers are above
                if you need the rules before it lands here.
              </p>
            )}
            <p className="flex items-start gap-2 min-w-0 text-xs text-pearl-white/35">
              <Trophy className="w-3.5 h-3.5 shrink-0 text-soft-gold" aria-hidden="true" />
              <span className="min-w-0 break-words">{FEST.name} · {FEST.dates}</span>
            </p>
          </div>
        </div>
      </div>

      <EventContactSheet event={contacting ? event : null} onClose={() => setContacting(false)} />
      <EventMoreSheet event={event} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
