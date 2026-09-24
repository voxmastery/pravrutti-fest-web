"use client";

import Link from "next/link";
import { scheduleDays, longRunning, workshops, entryRowSpan, type ScheduleDay, type TrackEntry } from "@/lib/schedule";

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

/** True when some earlier row's cell spans down into this one. */
function coveredFromAbove(day: ScheduleDay, blockIndex: number, track: TrackEntry["track"]): boolean {
  for (let i = 0; i < blockIndex; i++) {
    if (day.blocks[i].kind !== "tracks") continue;
    if (i + entryRowSpan(day, i, track) > blockIndex) return true;
  }
  return false;
}

function Cell({
  entry,
  blockTime,
  rowSpan = 1,
}: {
  entry: TrackEntry | undefined;
  blockTime: string;
  rowSpan?: number;
}) {
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
        <span className="block text-[12px] text-champagne-gold/85 mt-1 tabular-nums">{entry.time}</span>
      )}
    </>
  );

  /* A merged cell is taller than its text. Sitting that text against the top
     edge leaves a gap underneath that reads as a second, empty cell — the
     very hole the span was added to close — so it is centred in the box it
     actually occupies, the way the sheet's own merged cells are.

     The padding moves off the cell and onto the inner box so that box can be
     the full height of the cell: otherwise the link is only as tall as its
     words, and the bottom third of a merged cell looks clickable and is not. */
  const fill = `flex h-full flex-col px-3 py-3 ${rowSpan > 1 ? "justify-center" : "justify-start"}`;

  return (
    <td
      rowSpan={rowSpan > 1 ? rowSpan : undefined}
      /* h-px is the long-standing trick that gives a table cell a definite
         height for its child to resolve `h-full` against; the cell still
         grows to its real size, and without it the link is only as tall as
         its words. */
      className={`border border-royal-wine/60 bg-cosmic-purple/40 p-0 h-px ${
        rowSpan > 1 ? "align-middle" : "align-top"
      }`}
    >
      {entry.eventId ? (
        <Link
          href={`/events/${entry.eventId}`}
          className={`${fill} rounded-sm hover:bg-cosmic-purple/90 hover:ring-1 hover:ring-inset hover:ring-cyber-pink/60 transition-colors`}
        >
          {body}
        </Link>
      ) : (
        <div className={fill}>{body}</div>
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
                className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[13px] font-bold tracking-wide text-pearl-white/80 whitespace-nowrap"
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
                className="border border-royal-wine/60 bg-cosmic-purple/40 px-3 py-3 text-[13px] text-champagne-gold/85 tabular-nums align-top"
              >
                {l.time}
              </td>
            </tr>
          ))}
          {workshops.map((w) => (
            <tr key={w.date}>
              <th
                scope="row"
                className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[13px] font-bold tracking-wide text-pearl-white/80 whitespace-nowrap"
              >
                {w.date}
              </th>
              <td colSpan={4} className="border border-royal-wine/60 bg-cosmic-purple/40 px-3 py-3 align-top">
                <span className="block font-display text-[11px] font-black uppercase tracking-[0.18em] text-cyber-pink">
                  Workshops · {w.club}
                </span>
                <ul className="mt-2 space-y-1.5">
                  {w.sessions.map((session) => (
                    <li key={session.person} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="font-display text-[13px] font-bold text-pearl-white">{session.person}</span>
                      <span className="text-[12px] text-pearl-white/55">{session.expertise}</span>
                      <span className="text-[12px] text-champagne-gold/85 tabular-nums whitespace-nowrap">{session.time}</span>
                    </li>
                  ))}
                </ul>
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
                className="w-[188px] border border-royal-wine/60 bg-champagne-gold/15 px-3 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.14em] text-champagne-gold"
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
              block.kind === "banner" ? (
                <tr key={i}>
                  <th
                    scope="row"
                    className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[13px] font-bold tracking-wide text-pearl-white/80 tabular-nums whitespace-nowrap"
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
                    className="border border-royal-wine/60 bg-deep-plum/60 px-3 py-3 text-left font-display text-[13px] font-bold tracking-wide text-pearl-white/80 tabular-nums whitespace-nowrap"
                  >
                    {block.time}
                  </th>
                  {TRACKS.map((t) =>
                    /* A cell reaching down from an earlier row already owns
                       this column here. Emitting an empty <td> under it would
                       push the whole row one column to the right. */
                    coveredFromAbove(day, i, t) ? null : (
                      <Cell
                        key={t}
                        entry={block.entries.find((e) => e.track === t)}
                        blockTime={block.time}
                        rowSpan={entryRowSpan(day, i, t)}
                      />
                    ),
                  )}
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
