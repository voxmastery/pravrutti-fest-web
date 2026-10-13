"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FEE_PER_HEAD } from "@/lib/applications";
import type { TeamPreview } from "@/lib/teams";
import { Check, Copy, Users } from "lucide-react";

const ROSTER_MS = 20_000;

/**
 * The signed-in member's team for one event, including name+email roster.
 * Re-asks on an interval and when the tab is focused so a joiner appears
 * without a reload. Never call this for a visitor who is not on the team —
 * the route already withholds the roster from verify-by-code.
 */
export function useMyTeamState(
  eventId: string,
  enabled = true,
  /* Bump to re-read immediately — the roster already polls, but a lead who
     has just removed somebody should not watch the old name sit there. */
  refreshKey = 0,
): { team: TeamPreview | null; settled: boolean } {
  const [team, setTeam] = useState<TeamPreview | null>(null);
  /* False until the first answer, so a create-team form is not flashed at a
     lead who already has one while the roster is still loading. */
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!enabled || !eventId) {
      setTeam(null);
      setSettled(true);
      return;
    }
    let alive = true;
    /* A new lookup (including the first) has not answered yet. Polls call
       load() without clearing this, so the form does not vanish every few
       seconds. */
    setSettled(false);
    const load = () => {
      fetch(`/api/teams?event=${encodeURIComponent(eventId)}&mine=1`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive) return;
          setTeam(d?.team?.code ? d.team : null);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setSettled(true);
        });
    };
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    const pulse = window.setInterval(load, ROSTER_MS);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(pulse);
    };
  }, [eventId, enabled, refreshKey]);

  return { team, settled };
}

export function useMyTeam(
  eventId: string,
  enabled = true,
  refreshKey = 0,
): TeamPreview | null {
  return useMyTeamState(eventId, enabled, refreshKey).team;
}

/**
 * Persistent shareable code for a team that already exists — including after
 * the lead has submitted. The code itself never regenerates; this is just the
 * surface so they can still invite until the event's max size.
 *
 * Names and emails come from GET /api/teams?mine=1, which only answers the
 * caller who is already on the team. Verify-by-code never includes them.
 */
export function TeamInviteCard({
  team,
  level = 2,
}: {
  team: TeamPreview;
  level?: 2 | 3;
}) {
  const [copied, setCopied] = useState(false);
  const Heading = level === 2 ? "h2" : "h3";
  /* The lead first, marked by who the team says leads it. The roster is in
     the order people joined, and a team whose lead was changed would
     otherwise label the wrong person. Falls back to the first to join where
     the lead is not sent. */
  const lead = team.leadEmail?.toLowerCase();
  const isLeadOf = (p: { email: string }, i: number) => (lead ? p.email.toLowerCase() === lead : i === 0);
  const people = [...(team.members ?? [])].sort(
    (a, b) => Number(isLeadOf(b, 1)) - Number(isLeadOf(a, 1)),
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(team.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* insecure context — they can still select the code */
    }
  };

  return (
    <section className="w-full min-w-0 rounded-2xl border border-royal-wine bg-cosmic-purple/70 backdrop-blur-md overflow-hidden cyber-box">
      <div className="px-3 sm:px-4 py-2.5 bg-midnight-navy/80 border-b border-royal-wine">
        <Heading className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-pearl-white/55">
          Your team code
        </Heading>
      </div>
      <div className="p-3 sm:p-4 space-y-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-full border border-royal-wine bg-midnight-navy flex items-center justify-center">
            <Users className="w-4 h-4 text-champagne-gold" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="font-display text-sm font-bold text-pearl-white break-words">{team.name}</p>
            <p className="text-xs text-pearl-white/60 leading-relaxed break-words">
              {team.isFull
                ? `Team is full (${team.memberCount}/${team.maxMembers}).` : `Share this code — teammates can still join until ${team.maxMembers} including you. The team lead pays ₹${FEE_PER_HEAD}; joiners do not.`}
            </p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-pearl-white/55">
            <span>Slots</span>
            <span>{team.memberCount} of {team.maxMembers}</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-label="Team slots"
            aria-valuenow={team.memberCount}
            aria-valuemin={0}
            aria-valuemax={team.maxMembers}
          >
            <div
              className="h-full rounded-full bg-champagne-gold"
              style={{ width: `${Math.min(100, Math.round((team.memberCount / Math.max(team.maxMembers, 1)) * 100))}%` }}
            />
          </div>
        </div>
        {/* The code gets its own full-width line. Sharing a row with the Copy
            button left a 12-character code breaking across three lines on a
            phone, which is unreadable and unusable for something meant to be
            read aloud or typed by a teammate. */}
        <div className="rounded-xl bg-midnight-navy border border-royal-wine px-3 py-3 space-y-2.5 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-pearl-white/40">Team code</p>
            <p className="text-[15px] sm:text-base font-medium tracking-[0.1em] text-pearl-white mt-1 break-all leading-snug">
              {team.code}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-xs text-pearl-white/45 min-w-0 truncate">
              {team.memberCount}/{team.maxMembers} members
            </p>
            <Button
              type="button" onClick={handleCopy}
              className="h-9 rounded-xl border border-royal-wine bg-cosmic-purple text-pearl-white/80 hover:bg-deep-plum hover:text-pearl-white text-sm px-3 shrink-0 cursor-pointer inline-flex items-center gap-1.5" aria-label="Copy team code" >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        {people.length > 0 && (
          <ul className="space-y-2 min-w-0" aria-label="Team members">
            {people.map((person, i) => (
              <li
                key={person.email}
                className="flex items-start justify-between gap-3 min-w-0 overflow-hidden rounded-xl border border-royal-wine/80 bg-midnight-navy/50 px-3 py-2.5" >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-pearl-white truncate">{person.name}</p>
                  <a
                    href={`mailto:${person.email}`}
                    className="block text-xs text-pearl-white/50 break-all hover:text-champagne-gold transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
                    {person.email}
                  </a>
                </div>
                {isLeadOf(person, i) && (
                  <span className="shrink-0 font-display text-[10px] font-bold uppercase tracking-widest text-champagne-gold/80 pt-0.5">
                    Lead
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
