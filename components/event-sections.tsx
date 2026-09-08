"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Hourglass, Lock, Mail, MapPin, MoreHorizontal, RotateCcw, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Event, PRESENTER, contacts, clubFor, eventWhen } from "@/lib/pravrutti-data";
import { EVENT_PAGE_STATUS, type AppStatus } from "@/lib/applications";
import type { CoordinatorPhones } from "@/hooks/use-coordinator-phones";

/**
 * The shared vocabulary of an event surface.
 *
 * The full page and the slide-over panel both render these, so the two cannot
 * drift into telling a visitor different things about the same event — which is
 * exactly what happened while each kept its own copy of the location row.
 *
 * `level` exists because the same section is an h2 on the event page (under the
 * event's h1) and an h3 in the panel (under the panel's own h2 title).
 */
export function SectionLabel({
  children,
  action,
  level = 2,
}: {
  children: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="flex items-end justify-between gap-4 min-w-0 border-b border-royal-wine/70 pb-2">
      <Heading className="min-w-0 font-display text-[10px] font-black uppercase tracking-[0.22em] text-pearl-white/45 break-words">
        {children}
      </Heading>
      {action}
    </div>
  );
}

/** Initials disc. Circles for people, soft squares for organisations — the
    distinction Luma draws, and it saves labelling every row. */
export function InitialsAvatar({
  name,
  org = false,
  className = "",
}: {
  name: string;
  org?: boolean;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true" className={`shrink-0 flex items-center justify-center border font-display font-black ${
        org
          ? "rounded-xl bg-neon-purple/70 border-cyber-pink/40 text-champagne-gold" : "rounded-full bg-deep-plum border-royal-wine text-pearl-white/80" } ${className}`}
    >
      {initials}
    </span>
  );
}

const STATUS_LINE: Record<AppStatus, { label: string; tone: string; Icon: typeof Hourglass }> = {
  pending: { label: EVENT_PAGE_STATUS.pending, tone: "text-champagne-gold", Icon: Hourglass },
  confirmed: { label: EVENT_PAGE_STATUS.confirmed, tone: "text-success-soft", Icon: CheckCircle2 },
  declined: { label: EVENT_PAGE_STATUS.declined, tone: "text-pearl-white/45", Icon: RotateCcw },
};

/**
 * Where this viewer stands, in one line.
 *
 * Says nothing when there is nothing to say — a visitor who has not applied
 * does not need to be told so, and a "not registered" line would sit directly
 * above the button that fixes it. Nothing is shown while the lookup is in
 * flight either, so the line appears once and never flickers.
 *
 * The paragraph itself is always in the tree, empty and `empty:hidden`, so it
 * takes no space but is a live region from first paint. A live region created
 * at the same moment as its content is not announced, which is the whole point
 * of one here: the status arrives after the page is already readable.
 */
export function EventStatusLine({
  status,
  className = "",
}: {
  status: AppStatus | null;
  className?: string;
}) {
  const line = status ? STATUS_LINE[status] : null;

  return (
    <p
      aria-live="polite" className={`empty:hidden flex flex-wrap items-center gap-2 min-w-0 text-sm ${line?.tone ?? ""} ${className}`}
    >
          {line && (
            <>
              <line.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{line.label}</span>
            </>
          )}
    </p>
  );
}

const hostActionClass =
  "h-16 min-w-0 rounded-xl font-display text-[10px] sm:text-xs font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1 cursor-pointer";

/**
 * Luma's action row under the status line.
 *
 * Contact/More stay behind `registered` (pending, confirmed, or staff) — that
 * gate lives on /api/events/coordinators. My Ticket is confirmed-only: there
 * is no QR until organisers issue one. Unregistered visitors see none of the
 * three.
 */
export function EventHostActions({
  registered,
  confirmed,
  ticketHref,
  onContact,
  onMore,
  className = "",
}: {
  registered: boolean;
  confirmed: boolean;
  ticketHref: string;
  onContact: () => void;
  onMore: () => void;
  className?: string;
}) {
  if (!registered) return null;

  return (
    <div className={`grid gap-3 ${confirmed ? "grid-cols-3" : "grid-cols-2"} ${className}`}>
      {confirmed && (
        <Button
          asChild
          className={`${hostActionClass} bg-pearl-white hover:bg-white text-midnight-navy border-0`}
        >
          <Link href={ticketHref}>
            <Ticket className="w-5 h-5" aria-hidden="true" />
            My Ticket
          </Link>
        </Button>
      )}
      <Button
        variant="outline" onClick={onContact}
        className={`${hostActionClass} border-royal-wine bg-cosmic-purple text-pearl-white/85 hover:bg-deep-plum hover:text-champagne-gold`}
      >
        <Mail className="w-5 h-5" aria-hidden="true" />
        Contact
      </Button>
      <Button
        variant="outline" onClick={onMore}
        className={`${hostActionClass} border-royal-wine bg-cosmic-purple text-pearl-white/85 hover:bg-deep-plum hover:text-champagne-gold`}
      >
        <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
        More
      </Button>
    </div>
  );
}

/**
 * The host line under the title — Luma's "DevAarambh Event Calendar ›".
 *
 * Names the organising club where the repo actually records one, and the fest
 * itself otherwise. It never guesses a club: see Event.club.
 */
export function EventHostLine({ event }: { event: Event }) {
  const club = clubFor(event);
  const label = club ? club.name : PRESENTER.name;
  const sub = club ? club.tagline : PRESENTER.org;

  return (
    <Link
      href="/about" className="group flex items-center gap-2.5 -my-1 py-1 min-h-11 min-w-0 w-full max-w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
      <InitialsAvatar name={label} org className="w-7 h-7 text-[9px]" />
      <span className="min-w-0 flex-1 text-sm leading-snug text-pearl-white/70 group-hover:text-champagne-gold transition-colors break-words">
        {label}
        <span className="text-pearl-white/35"> · {sub}</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-pearl-white/35 group-hover:text-champagne-gold transition-colors" aria-hidden="true" />
    </Link>
  );
}

/** The compact "when" row. Times are per-event once the coordinators supply
    them; until then this states the fest range rather than inventing a slot. */
export function EventWhenRow({ event, onNavigate }: { event: Event; onNavigate?: () => void }) {
  const when = eventWhen(event);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 text-sm">
      <CalendarDays className="w-4 h-4 shrink-0 text-cyber-pink" aria-hidden="true" />
      <span className="min-w-0 text-pearl-white font-bold break-words">{when.line}</span>
      {!when.exact && (
        <Link
          href="/schedule" onClick={onNavigate}
          className="text-pearl-white/45 underline decoration-royal-wine hover:text-champagne-gold hover:decoration-champagne-gold transition-colors" >
          see timings
        </Link>
      )}
    </div>
  );
}

/**
 * Location, gated.
 *
 * A confirmed participant (or the event's staff) gets the hall; everyone else
 * gets the campus and an honest sentence about why. The hall is not merely
 * hidden here — it is absent from the bundle and the HTML entirely, and only
 * reaches this component through the entitlement check in
 * /api/events/coordinators. See lib/event-venues.ts.
 *
 * The map is pinned to the campus street address in every case, including for
 * approved viewers: an iframe URL is the one thing on the page a visitor can
 * read straight out of the markup, so putting a hall in the query would hand
 * back what the gate just withheld. "C BLOCK" is also not a thing Google can
 * find — the campus gate is what a participant actually navigates to.
 */
export function EventLocation({ access, level = 2 }: { access: CoordinatorPhones; level?: 2 | 3 }) {
  const { campus, address } = contacts.location;
  const hall = access.unlocked ? access.venue : null;

  return (
    <section className="space-y-3">
      <SectionLabel level={level}>Location</SectionLabel>

      {hall ? (
        <div className="space-y-0.5">
          <p className="font-display text-base font-bold text-pearl-white break-words">{hall}</p>
          <p className="text-sm text-pearl-white/55 break-words">
            {campus} · {address}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="font-display text-base font-bold text-pearl-white break-words">{campus}</p>
          <p className="flex items-start gap-2 min-w-0 text-sm text-pearl-white/55">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyber-pink" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {access.unlocked
                ? "Your exact hall is still being assigned — it will appear here and on your ticket." : access.registered
                ? "The exact hall unlocks once your registration is confirmed." : "Please register to see the exact location of this event."}
            </span>
          </p>
          <p className="text-sm text-pearl-white/35 break-words">{address}</p>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border border-royal-wine grayscale-[35%] contrast-[1.05]">
        <iframe
          title={`Map — ${campus}`}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
          className="w-full h-44 sm:h-52 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>

      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
        target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 min-h-11 -my-1 py-1 text-sm text-pearl-white/55 hover:text-champagne-gold transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
        <MapPin className="w-3.5 h-3.5 shrink-0 text-cyber-pink" aria-hidden="true" /> Get directions
      </a>
    </section>
  );
}

/** The remaining fest-specific facts, as a definition list. Rows are omitted
    when an event has no answer, so this shrinks rather than showing blanks. */
export function EventFormat({ rows, level = 2 }: { rows: { k: string; v: string }[]; level?: 2 | 3 }) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel level={level}>Format</SectionLabel>
      <dl className="rounded-2xl border border-royal-wine bg-cosmic-purple/50 divide-y divide-royal-wine/60">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-4 px-4 py-3 min-w-0">
            <dt className="text-sm text-pearl-white/50 shrink-0">{r.k}</dt>
            <dd className="text-sm text-pearl-white text-right min-w-0 break-words">{r.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The organisation behind the fest — Luma's "Presented by" card. Identical on
    every event, which is the point: it is the fest's own identity block. */
export function EventPresenter({ level = 2 }: { level?: 2 | 3 }) {
  return (
    <section className="space-y-3">
      <SectionLabel level={level}>Presented by</SectionLabel>
      <div className="flex items-start gap-3">
        <InitialsAvatar name={PRESENTER.name} org className="w-11 h-11 text-xs" />
        <div className="min-w-0 space-y-1">
          <p className="font-display text-sm font-bold text-champagne-gold break-words">{PRESENTER.name}</p>
          <p className="text-xs text-pearl-white/45 break-words">{PRESENTER.org}</p>
        </div>
      </div>
      <p className="text-sm text-pearl-white/60 leading-relaxed break-words">{PRESENTER.blurb}</p>
      <p className="text-sm">
        <a
          href={`mailto:${PRESENTER.email}`}
          className="inline-flex items-center min-h-11 -my-1 py-1 text-pearl-white/55 hover:text-champagne-gold transition-colors underline decoration-royal-wine rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
          {PRESENTER.email}
        </a>
      </p>
    </section>
  );
}