"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import Link from "next/link";
import { Info, Clock, ArrowUpRight, Moon, BedDouble, GraduationCap } from "lucide-react";
import { FEST } from "@/lib/pravrutti-data";
import { scheduleDays, longRunning, workshops, accommodation, type TrackEntry } from "@/lib/schedule";
import { ScheduleGrid } from "@/components/schedule-grid";

/* Rendered from lib/schedule.ts rather than an image. The schedule that used to
   sit here WAS an image, and it kept showing the 2025 roster long after the
   events changed. Markup also means it reads on a phone, links to each event,
   and is checked against the roster by test/schedule.test.ts. */

function EntryCard({ entry, blockTime }: { entry: TrackEntry; blockTime: string }) {
  const spans = entry.time && entry.time !== blockTime;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyber-pink/80">
          Track {entry.track}
        </span>
        {entry.eventId && (
          <ArrowUpRight className="w-3.5 h-3.5 text-pearl-white/25 group-hover:text-champagne-gold transition-colors shrink-0" />
        )}
      </div>
      <p className="mt-2 font-display text-sm font-bold tracking-wide text-pearl-white leading-snug">
        {entry.label}
      </p>
      {entry.host && <p className="mt-1 text-[12px] text-pearl-white/45">{entry.host}</p>}
      {/* Only when it outruns its block — a merged cell in the sheet. */}
      {spans && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-champagne-gold/85 tabular-nums">
          <Clock className="w-3 h-3" /> {entry.time}
        </p>
      )}
    </>
  );

  const base =
    "block rounded-xl border border-royal-wine bg-cosmic-purple/50 px-3.5 py-3 h-full transition-colors";

  return entry.eventId ? (
    <Link href={`/events/${entry.eventId}`} className={`${base} group hover:border-cyber-pink/70 hover:bg-cosmic-purple/80`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export default function SchedulePage() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => setIsVisible(true), []);

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div key={`h-${i}`} className="absolute h-px bg-neon-purple/40" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }} />
        ))}
        {[...Array(12)].map((_, i) => (
          <div key={`v-${i}`} className="absolute w-px bg-royal-wine/40" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }} />
        ))}
      </div>
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-display tracking-widest text-cyber-pink uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-neon-purple" />
            ARENA STAGE MAP
            <span className="w-8 h-px bg-neon-purple" />
          </span>
          <h1 className="text-4xl md:text-7xl font-display tracking-wider text-pearl-white mb-6 font-black">
            PRAVRUTTI <span className="text-stroke">SCHEDULE</span>
          </h1>
          <p className="text-base md:text-xl text-pearl-white/70 leading-relaxed max-w-2xl mx-auto">
            Three days, four tracks, {FEST.dates}. Tap any arena for its rules, prizes and coordinators.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-14 p-4 rounded-xl border border-cyber-pink/40 bg-cosmic-purple/90 flex gap-4 items-center justify-center shadow-xl shadow-neon-purple/15 cyber-box">
          <Info className="w-5 h-5 text-champagne-gold shrink-0" />
          <p className="text-sm md:text-base text-pearl-white/85 text-center">
            Check for clashes before you register — timings here are the coordinators&apos; latest.
          </p>
        </div>

        {/* Beds. Highlighted because it answers the question that decides
            whether somebody from out of town can come at all, and it is easy
            to miss in a wall of timings. */}
        <div className="mb-10 rounded-2xl border border-champagne-gold/45 bg-champagne-gold/[0.10] px-5 py-4 cyber-box">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="inline-flex items-center gap-2.5 font-display text-sm font-black uppercase tracking-[0.16em] text-champagne-gold">
              <BedDouble className="w-4 h-4 shrink-0" aria-hidden="true" />
              Accommodation will be provided
            </p>
            <p className="font-display text-base font-black tracking-wide text-pearl-white tabular-nums">
              {accommodation.currency}
              {accommodation.ratePerHeadPerDay}
              <span className="ml-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-pearl-white/55">
                per head, per day
              </span>
            </p>
          </div>
          {/* A bed is booked by ringing somebody, so the numbers dial. Most of
              the people who need one are reading this on the phone they would
              call from. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-champagne-gold/20 pt-3">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-pearl-white/45">
              To book
            </span>
            {accommodation.contacts.map((c) => (
              <a
                key={c.phone}
                href={`tel:${c.phone}`}
                /* py/-my keeps the row looking the same while giving the
                   number a finger-sized target: this is dialled from a phone. */
                className="inline-flex items-baseline gap-2 py-2.5 -my-1.5 text-[13px] text-pearl-white/80 hover:text-champagne-gold transition-colors"
                aria-label={`Call ${c.name} about accommodation on ${c.phone}`}
              >
                <span className="font-semibold">{c.name}</span>
                <span className="tabular-nums text-champagne-gold/90">{c.phone}</span>
              </a>
            ))}
          </div>
        </div>

        {/* The coordinators' grid, in the site's colours. Five columns need the
            width, so below `md` the same data stacks into cards underneath. */}
        <div className="hidden md:block">
          <ScheduleGrid />
        </div>

        {/* Days — the small-screen reading of the same schedule. */}
        <div className="space-y-14 md:hidden">
          {/* Runs alongside the tracks */}
          <section aria-labelledby="alongside">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-5">
              <h2 id="alongside" className="font-display text-2xl md:text-3xl font-black tracking-wide text-champagne-gold">
                RUNS ALONGSIDE
              </h2>
              <span className="h-px flex-1 min-w-8 bg-royal-wine" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {longRunning.map((l) => (
                <Link
                  key={l.eventId}
                  href={`/events/${l.eventId}`}
                  className="group rounded-xl border border-royal-wine bg-cosmic-purple/50 px-4 py-3.5 hover:border-cyber-pink/70 hover:bg-cosmic-purple/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyber-pink/80">
                      <Moon className="w-3 h-3" /> {l.date}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-pearl-white/25 group-hover:text-champagne-gold transition-colors shrink-0" />
                  </div>
                  <p className="mt-2 font-display text-sm font-bold tracking-wide text-pearl-white">{l.label}</p>
                  <p className="mt-1 text-[12px] text-pearl-white/45">{l.host}</p>
                  <p className="mt-2 text-[12px] text-champagne-gold/85 tabular-nums">{l.time}</p>
                </Link>
              ))}
              {workshops.map((w) => (
                <div
                  key={w.date}
                  className="rounded-xl border border-cyber-pink/35 bg-cyber-pink/[0.07] px-4 py-3.5 sm:col-span-2"
                >
                  <p className="inline-flex items-center gap-1.5 font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyber-pink">
                    <GraduationCap className="w-3 h-3" /> Workshops · {w.club} · {w.date}
                  </p>
                  <ul className="mt-2.5 space-y-2.5">
                    {w.sessions.map((session) => (
                      <li key={session.person}>
                        <p className="font-display text-sm font-bold tracking-wide text-pearl-white">{session.person}</p>
                        <p className="mt-0.5 text-[12px] text-pearl-white/55 leading-relaxed">{session.expertise}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-champagne-gold/85 tabular-nums">
                          <Clock className="w-3 h-3" /> {session.time}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {scheduleDays.map((day) => (
            <section key={day.n} aria-labelledby={`day-${day.n}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-5">
                <h2 id={`day-${day.n}`} className="font-display text-2xl md:text-3xl font-black tracking-wide text-champagne-gold">
                  DAY {day.n}
                </h2>
                <span className="font-display text-sm tracking-[0.18em] uppercase text-pearl-white/50">
                  {day.date}
                </span>
                <span className="h-px flex-1 min-w-8 bg-royal-wine" />
              </div>

              <div className="space-y-4">
                {day.blocks.map((block, i) =>
                  block.kind === "banner" ? (
                    <div
                      key={i}
                      className="rounded-2xl border border-champagne-gold/30 bg-champagne-gold/[0.07] px-5 py-4 flex flex-wrap items-center justify-between gap-2 cyber-box"
                    >
                      <span className="font-display text-base md:text-lg font-black tracking-wide text-champagne-gold">
                        {block.label}
                      </span>
                      <span className="text-[13px] text-pearl-white/60 tabular-nums">{block.time}</span>
                    </div>
                  ) : (
                    <div key={i} className="rounded-2xl border border-royal-wine bg-cosmic-purple/30 p-4 md:p-5">
                      <p className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.14em] uppercase text-pearl-white/70 mb-3">
                        <Clock className="w-3.5 h-3.5 text-cyber-pink" />
                        <span className="tabular-nums">{block.time}</span>
                      </p>
                      {/* One column on a phone, four on a wide screen — a
                          four-column grid is unreadable at 375px. */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {block.entries.map((entry) => (
                          <EntryCard key={entry.track} entry={entry} blockTime={block.time} />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          ))}

        </div>

        <div className="mt-14 text-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-xl border border-royal-wine hover:border-cyber-pink px-5 h-11 font-display text-sm font-bold tracking-widest uppercase text-champagne-gold transition-colors"
          >
            Browse all events <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
