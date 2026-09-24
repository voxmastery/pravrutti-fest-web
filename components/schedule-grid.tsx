"use client";

import Link from "next/link";
import { scheduleDays, longRunning, type TrackEntry } from "@/lib/schedule";

/**
 * The coordinators' sheet, rebuilt in the site's own colours.
 *
 * Same shape as the spreadsheet — a time column, four track columns, and
 * full-width bands for the ceremonies — but drawn with the fest palette
 * instead of the sheet's yellow/teal/maroon, and as a real table rather than a
 * picture of one. That keeps every arena clickable and the text crisp at any
 * size, which a flattened image cannot be.
 *
 * Shown from `md` up; below that the page stacks the same data into cards,
 * because five columns on a 375px screen is unreadable however it is drawn.
 */

const TRACKS = [1, 2, 3, 4] as const;

function Cell({ entry, blockTime }: { entry: TrackEntry | undefined; blockTime: string }) {
  if (!entry)
    return <td className="border border-royal-wine/60 bg-midnight-navy/40 px-3 py-3" />;

  const spans = entry.time && entry.time !== blockTime;
  const body = (
    <>
      <span className="block font-display text-[13px] font-bold tracking-wide text-pearl-white leading-snug">
        {entry.label}
      </span>
      {entry.host && <span className="block text-[11px] text-pearl-white/45 mt-0.5">{entry.host}</span>}
      {spans && (
        <span className="block text-[11px] text-champagne-gold/80 mt-1 tabular-nums">{entry.time}</span>
      )}
    </>
  );

  return (
    <td className="border border-royal-wine/60 bg-cosmic-purple/40 px-3 py-3 align-top">
      {entry.eventId ? (
        <Link
          href={`/events/${entry.eventId}`}
          className="block -m-3 p-3 rounded-sm hover:bg-cosmic-purple/90 hover:ring-1 hover:ring-cyber-pink/60 transition-colors"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </td>
  );
}

export function ScheduleGrid() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-royal-wine cyber-box shadow-2xl shadow-neon-purple/20">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="caption-top bg-cyber-pink/90 px-4 py-3 font-display text-sm md:text-base font-black uppercase tracking-[0.2em] text-white text-center">
          3-Day Tech Fest Schedule
        </caption>

        {/* First, not last: these run through the whole fest, so somebody reading
            the day below needs to already know they are on. */}
        <tbody>
          <tr>
            <th
              scope="col"
              colSpan={5}
              className="border border-royal-wine/60 bg-royal-wine/70 px-3 py-2.5 text-left font-display text-[11px] font-black uppercase tracking-[0.16em] text-pearl-white"
            >
              Runs alongside
            </th>
          </tr>
          {longRunning.map((l) => (
            <tr key={l.eventId}>
              <th
                scope="row"
                className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[11px] font-bold tracking-wider text-pearl-white/70"
              >
                {l.date}
              </th>
              <td className="border border-royal-wine/60 bg-cosmic-purple/40 px-3 py-3 align-top">
                <Link
                  href={`/events/${l.eventId}`}
                  className="block -m-3 p-3 rounded-sm hover:bg-cosmic-purple/90 hover:ring-1 hover:ring-cyber-pink/60 transition-colors"
                >
                  <span className="block font-display text-[13px] font-bold tracking-wide text-pearl-white">
                    {l.label}
                  </span>
                  <span className="block text-[11px] text-pearl-white/45 mt-0.5">{l.host}</span>
                </Link>
              </td>
              <td
                colSpan={3}
                className="border border-royal-wine/60 bg-cosmic-purple/40 px-3 py-3 text-[12px] text-champagne-gold/85 tabular-nums align-top"
              >
                {l.time}
              </td>
            </tr>
          ))}
        </tbody>

        {scheduleDays.map((day) => (
          <tbody key={day.n}>
            {/* Day header — the sheet's cyan time cell + maroon track cells. */}
            <tr>
              <th
                scope="col"
                className="w-[148px] border border-royal-wine/60 bg-champagne-gold/15 px-3 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.14em] text-champagne-gold"
              >
                {day.date}
              </th>
              {TRACKS.map((t) => (
                <th
                  key={t}
                  scope="col"
                  className="border border-royal-wine/60 bg-royal-wine/70 px-3 py-2.5 text-center font-display text-[11px] font-black uppercase tracking-[0.16em] text-pearl-white"
                >
                  Track {t}
                </th>
              ))}
            </tr>

            {day.blocks.map((block, i) =>
              block.kind === "workshop" ? (
                /* One merged cell across the tracks: a workshop is not a fifth
                   arena competing with them, it runs alongside all four. */
                <tr key={i}>
                  <th
                    scope="row"
                    className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[11px] font-bold tracking-wider text-pearl-white/70 tabular-nums"
                  >
                    {block.time}
                  </th>
                  <td colSpan={4} className="border border-cyber-pink/35 bg-cyber-pink/[0.09] px-3 py-3 align-top">
                    <span className="block font-display text-[11px] font-black uppercase tracking-[0.18em] text-cyber-pink">
                      Workshops · {block.club}
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {block.sessions.map((w) => (
                        <li key={w.person} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                          <span className="font-display text-[13px] font-bold text-pearl-white">{w.person}</span>
                          <span className="text-[12px] text-pearl-white/55">{w.expertise}</span>
                          <span className="text-[11px] text-champagne-gold/85 tabular-nums">{w.time}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ) : block.kind === "banner" ? (
                <tr key={i}>
                  <th
                    scope="row"
                    className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[11px] font-bold tracking-wider text-pearl-white/70 tabular-nums"
                  >
                    {block.time}
                  </th>
                  <td
                    colSpan={4}
                    className="border border-champagne-gold/30 bg-champagne-gold/[0.12] px-3 py-3 text-center font-display text-sm font-black uppercase tracking-[0.2em] text-champagne-gold"
                  >
                    {block.label}
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <th
                    scope="row"
                    className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[11px] font-bold tracking-wider text-pearl-white/70 tabular-nums"
                  >
                    {block.time}
                  </th>
                  {TRACKS.map((t) => (
                    <Cell
                      key={t}
                      entry={block.entries.find((e) => e.track === t)}
                      blockTime={block.time}
                    />
                  ))}
                </tr>
              )
            )}

            {/* A gap between days, as the sheet has. */}
            <tr aria-hidden="true">
              <td colSpan={5} className="h-3 bg-transparent" />
            </tr>
          </tbody>
        ))}

      </table>
    </div>
  );
}
