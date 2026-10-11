"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Hourglass, Lock, Mic, Radio } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import { PALETTE } from "@/lib/palette";
import {
  CONFIRM_FINAL,
  COPY,
  ELEVENLABS_BANNER,
  SUCCESS_SURPRISES,
  TRACK_CAP,
  componentsReadyLine,
  countdownParts,
  formatOpensAt,
  formatPickTime,
  trackCardLabel,
  trackFullName,
  type ParticipantState,
  type PublicTrack,
  type ScreenId,
} from "@/lib/track-pick";
import { HoldToLock } from "@/components/hacktivate/hold-to-lock";

type State = ParticipantState;

const POLL_MS = 4000;

function initials(name: string | null, email: string | null) {
  const source = (name || email || "?").replace(/^DEV\s+/i, "");
  const bits = source.split(/[\s@._-]+/).filter(Boolean);
  return ((bits[0]?.[0] ?? "?") + (bits[1]?.[0] ?? "")).toUpperCase();
}

function seatTone(track: { full: boolean; left: number }) {
  if (track.full) return "border-danger/50 bg-danger/15 text-danger";
  if (track.left <= 5) return "border-soft-gold/50 bg-soft-gold/15 text-champagne-gold";
  return "border-success/40 bg-success/15 text-success-soft";
}

export function TrackPickScreen() {
  const me = useIdentity();
  const [data, setData] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"browse" | "confirm">("browse");
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLHeadingElement | null>(null);

  const apply = useCallback((json: State) => {
    setData(json);
    if (json.serverNow) setOffset(Date.parse(json.serverNow) - Date.now());
    if (json.screen === "locked") setPhase("browse");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/hacktivate/track-pick", { cache: "no-store" });
      if (res.status === 401) {
        setSignedOut(true);
        setData(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "Could not load tracks.");
        return;
      }
      setSignedOut(false);
      setLoadError(null);
      apply(json);
    } catch {
      setLoadError("Network dropped. Tracks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!me.ready) return;
    if (!me.signedIn) {
      setSignedOut(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [me.ready, me.signedIn, refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 250);
    return () => window.clearInterval(id);
  }, [offset]);

  useEffect(() => {
    if (!me.signedIn) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [me.signedIn, refresh]);

  useEffect(() => {
    if (!data || data.screen !== "countdown") return;
    if (now >= Date.parse(data.opensAt)) void refresh();
  }, [now, data, refresh]);

  useEffect(() => {
    if (phase !== "confirm" || !selected || !data) return;
    const track = data.tracks.find((t) => t.id === selected);
    if (track?.full) {
      setPhase("browse");
      setFullMessage(`Sorry, Track ${selected} just filled. Another team grabbed the last seat while you were confirming. Your pick was not saved. Please pick another track.`);
      setSelected(null);
    }
  }, [data, phase, selected]);

  useEffect(() => {
    if (fullMessage) alertRef.current?.focus();
  }, [fullMessage]);

  useEffect(() => {
    if (phase === "confirm") holdRef.current?.querySelector("button")?.focus();
  }, [phase, attempt]);

  useEffect(() => {
    if (data?.screen === "locked") successRef.current?.focus();
  }, [data?.screen, data?.pick?.trackId]);

  useEffect(() => {
    if (phase !== "confirm") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPhase("browse");
        setLockError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const lockIn = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setLockError(null);
    try {
      const res = await fetch("/api/hacktivate/track-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: selected }),
      });
      const json = await res.json();
      if (json.serverNow) apply(json);
      if (json.ok || json.screen === "locked") {
        setFullMessage(null);
        setPhase("browse");
        return;
      }
      if (json.code === "full") {
        setPhase("browse");
        setSelected(null);
        setFullMessage(json.error);
        return;
      }
      setLockError(json.error ?? "That pick was not saved.");
      setAttempt((n) => n + 1);
    } catch {
      setLockError("Network dropped. Your pick was not saved — hold again to retry.");
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (!me.ready || (loading && !data && !signedOut)) return <Shell><Skeleton /></Shell>;

  if (signedOut || (me.ready && !me.signedIn)) {
    return (
      <Shell>
        <Card>
          <p className="font-display text-xl font-black">Sign in to pick your track</p>
          <p className="mt-2 text-sm text-white/70">{COPY.signIn}</p>
          <button
            type="button"
            onClick={() => me.signIn()}
            className="mt-5 h-12 w-full rounded-2xl bg-cyber-pink font-display text-xs font-bold tracking-[0.16em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold"
          >
            SIGN IN WITH GOOGLE
          </button>
        </Card>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <Card>
          <p className="font-semibold">{loadError ?? "Could not load tracks."}</p>
          <button type="button" onClick={() => { setLoading(true); void refresh(); }} className="mt-4 text-sm text-champagne-gold underline">
            Try again
          </button>
        </Card>
      </Shell>
    );
  }

  const screen = data.screen;
  const locked = screen === "locked" && data.pick;
  const confirming = phase === "confirm" && selected && data.canPick && !locked;
  const selectedTrack = data.tracks.find((t) => t.id === selected) ?? null;
  const chip = stepChip(screen, phase === "confirm", !!fullMessage);

  return (
    <Shell chip={chip} who={initials(me.name, me.email)}>
      {locked ? (
        <Success data={data} headingRef={successRef} />
      ) : confirming && selectedTrack ? (
        <Confirm
          data={data}
          track={selectedTrack}
          busy={busy}
          attempt={attempt}
          lockError={lockError}
          holdRef={holdRef}
          onCancel={() => {
            setPhase("browse");
            setLockError(null);
          }}
          onComplete={() => void lockIn()}
        />
      ) : (
        <Browse
          data={data}
          now={now}
          selected={selected}
          fullMessage={fullMessage}
          alertRef={alertRef}
          onSelect={(id) => {
            setFullMessage(null);
            setSelected(id);
          }}
          onContinue={() => {
            if (!selected) return;
            setLockError(null);
            setPhase("confirm");
          }}
        />
      )}
      <p className="mt-8 text-center text-sm">
        <Link href="/ticket" className="text-champagne-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink">
          Back to your ticket
        </Link>
      </p>
    </Shell>
  );
}

function stepChip(screen: ScreenId, confirm: boolean, raced: boolean) {
  if (confirm) return { n: "03", label: "CONFIRM" };
  if (screen === "locked") return { n: "04", label: "SUCCESS" };
  if (raced) return { n: "05", label: "FULL / RACE" };
  if (screen === "ineligible" || screen === "no_team") return { n: "06a", label: screen === "no_team" ? "NO TEAM" : "IN REVIEW" };
  if (screen === "member") return { n: "06b", label: "NON-LEAD" };
  if (screen === "countdown") return { n: "01", label: "BEFORE 9:30" };
  if (screen === "paused") return { n: "02", label: "PAUSED" };
  return { n: "02", label: "OPEN PICKER" };
}

function Shell({
  children,
  chip,
  who,
}: {
  children: React.ReactNode;
  chip?: { n: string; label: string };
  who?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-pearl-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${PALETTE.royalWine}55 1px, transparent 1px), linear-gradient(to bottom, ${PALETTE.royalWine}55 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-[440px] px-4 pb-16 pt-28 sm:pt-32">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-black tracking-wide text-pearl-white">
              PRAVRUTTI<span className="text-cyber-pink">2.0</span>
            </p>
            <p className="mt-2 inline-flex items-center rounded-full border border-cyber-pink/40 px-2.5 py-0.5 font-display text-[10px] tracking-[0.18em] text-cyber-pink">
              HACKTIVATE
            </p>
          </div>
          <div className="flex items-center gap-2">
            {chip && (
              <p className="rounded-full border border-soft-gold/50 bg-soft-gold/10 px-2.5 py-1 font-display text-[10px] tracking-[0.14em] text-champagne-gold">
                {chip.n} · {chip.label}
              </p>
            )}
            {who && (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neon-purple font-display text-[10px] font-black text-champagne-gold" aria-hidden="true">
                {who}
              </span>
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-royal-wine bg-deep-plum/80 p-5 ${className}`}>{children}</div>;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
      <div className="h-40 animate-pulse rounded-3xl bg-white/5" />
      <div className="h-40 animate-pulse rounded-3xl bg-white/5" />
    </div>
  );
}

function Banner() {
  return (
    <div className="mt-4 rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-3">
      <p className="flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.14em] text-champagne-gold">
        <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
        {ELEVENLABS_BANNER.title.toUpperCase()}
      </p>
      <p className="mt-1 text-sm leading-snug text-pearl-white/80">{ELEVENLABS_BANNER.body}</p>
    </div>
  );
}

function TeamChip({ data }: { data: State }) {
  if (!data.team) return null;
  const confirmed = data.team.status === "confirmed";
  const role = data.viewer.isLead ? "LEAD" : data.screen === "member" || data.screen === "locked" ? "MEMBER" : null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-royal-wine bg-cosmic-purple/80 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-black">{data.team.name}</p>
        <p className="truncate text-xs tracking-wide text-white/50">TEAM_ID {data.team.code}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full border px-2 py-0.5 font-display text-[10px] tracking-[0.14em] ${confirmed ? "border-success/40 text-success-soft" : "border-soft-gold/50 text-champagne-gold"}`}>
          {confirmed ? "CONFIRMED" : data.team.status === "in_review" ? "IN REVIEW" : "NOT CONFIRMED"}
        </span>
        {role && (
          <span className="rounded-full border border-cyber-pink/40 px-2 py-0.5 font-display text-[10px] tracking-[0.14em] text-cyber-pink">
            {role}
          </span>
        )}
      </div>
    </div>
  );
}

function Browse({
  data,
  now,
  selected,
  fullMessage,
  alertRef,
  onSelect,
  onContinue,
}: {
  data: State;
  now: number;
  selected: string | null;
  fullMessage: string | null;
  alertRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  const screen = data.screen;
  const interactive = screen === "picker" || screen === "paused";
  const showSelect = screen === "picker";
  const clock = countdownParts(now, Date.parse(data.opensAt));
  const anyFull = data.tracks.some((t) => t.full);
  const allFull = data.tracks.every((t) => t.full);

  return (
    <>
      <p className="font-display text-[11px] tracking-[0.22em] text-cyber-pink">// TRACK_PICK · HACKTIVATE 2026</p>
      <h1 className="mt-2 font-display text-3xl font-black leading-tight">Pick your track</h1>
      <p className="mt-1 text-sm text-white/60">
        {screen === "countdown"
          ? "24h hardware + AI hackathon · starts 14 Oct, 11:00 AM"
          : screen === "member"
            ? "Seats update live. Only your lead can lock a track."
            : "Seats update live. Once you confirm, it's final."}
      </p>
      <TeamChip data={data} />
      <Banner />

      {fullMessage && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-2xl border border-danger/50 bg-danger/15 px-4 py-3 text-sm leading-snug text-pearl-white outline-none"
        >
          <p className="font-semibold text-danger">Sorry, that track just filled</p>
          <p className="mt-1 text-white/80">{fullMessage}</p>
        </div>
      )}

      {screen === "no_team" && (
        <Card className="mt-4 text-center">
          <Lock className="mx-auto h-8 w-8 text-champagne-gold" aria-hidden="true" />
          <p className="mt-3 font-display text-lg font-black">{COPY.noTeamTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{data.message}</p>
        </Card>
      )}

      {screen === "ineligible" && (
        <Card className="mt-4 text-center">
          <Lock className="mx-auto h-8 w-8 text-champagne-gold" aria-hidden="true" />
          <p className="mt-3 font-display text-lg font-black">{COPY.ineligibleTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{COPY.ineligible}</p>
          <p className="mt-3 text-sm text-champagne-gold">{COPY.ineligibleHelp}</p>
        </Card>
      )}

      {screen === "member" && data.team && (
        <div className="mt-4 rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-3 text-sm">
          <p className="font-display text-[11px] tracking-[0.16em] text-champagne-gold">YOUR LEAD PICKS</p>
          <p className="mt-1 leading-snug text-white/80">
            Only {data.team.leadName} (team lead) can pick the track. You can watch live seats here. Status: not picked yet.
          </p>
        </div>
      )}

      {screen === "paused" && (
        <div role="status" className="mt-4 rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-3 text-sm text-white/80">
          {COPY.paused}
        </div>
      )}

      {screen === "countdown" && (
        <div className="mt-4" role="timer" aria-label={`Picking opens in ${clock.hrs} hours ${clock.min} minutes ${clock.sec} seconds`}>
          <p className="text-center font-display text-[11px] tracking-[0.2em] text-white/50">PICKING OPENS IN</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              [clock.hrs, "HRS"],
              [clock.min, "MIN"],
              [clock.sec, "SEC"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-2xl border border-royal-wine bg-cosmic-purple/80 py-3 text-center">
                <p className="font-display text-4xl font-black tabular-nums text-pearl-white" aria-hidden="true">{n}</p>
                <p className="mt-1 font-display text-[10px] tracking-[0.16em] text-white/45">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-white/70">
            {formatOpensAt(Date.parse(data.opensAt))}
          </p>
          <p className="mt-1 text-center text-sm text-white/55">
            First come, first served · 20 teams per track · one final pick per team
          </p>
        </div>
      )}

      <p className="mb-2 mt-6 font-display text-[11px] tracking-[0.2em] text-white/45">// PREVIEW THE TRACKS</p>
      <div className="space-y-3" aria-live="polite">
        {data.tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            mode={screen}
            selected={selected === track.id}
            canSelect={showSelect && !track.full}
            onSelect={() => onSelect(track.id)}
          />
        ))}
      </div>

      {showSelect && (
        <div className="sticky bottom-3 z-20 mt-4">
          <button
            type="button"
            disabled={!selected || allFull}
            onClick={onContinue}
            className="h-12 w-full rounded-full bg-cyber-pink font-display text-xs font-bold tracking-[0.14em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold disabled:bg-white/10 disabled:text-white/40"
          >
            {selected ? `CONTINUE WITH TRACK ${selected} →` : "SELECT A TRACK"}
          </button>
          <p className="mt-2 text-center text-xs text-white/45">
            {anyFull && !selected ? "If all 3 tracks fill, contact the organisers" : "Only your team lead can pick · 1 pick per team"}
          </p>
        </div>
      )}

      {interactive && screen === "paused" && (
        <p className="mt-4 text-center text-xs text-white/45">Only your team lead can pick · 1 pick per team</p>
      )}
    </>
  );
}

function TrackCard({
  track,
  mode,
  selected,
  canSelect,
  onSelect,
}: {
  track: PublicTrack;
  mode: ScreenId;
  selected: boolean;
  canSelect: boolean;
  onSelect: () => void;
}) {
  const lockedLook = mode === "ineligible" || mode === "no_team";
  const opens = mode === "countdown";
  return (
    <article
      data-testid={`track-${track.id}`}
      aria-label={trackCardLabel(track)}
      className={`rounded-3xl border p-4 ${selected ? "border-cyber-pink shadow-[0_0_0_1px_rgba(214,77,141,0.45)]" : "border-royal-wine"} ${lockedLook ? "opacity-60" : ""} bg-cosmic-purple/70`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[11px] tracking-[0.18em] text-cyber-pink">// TRACK_{track.id}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-display text-[10px] tracking-wide ${seatTone(track)}`}>
          {track.full ? `FULL · 0/${TRACK_CAP} left` : `${track.left}/${TRACK_CAP} left`}
        </span>
      </div>
      <h2 className="mt-2 font-display text-xl font-black leading-tight">{track.title}</h2>
      {track.theme && <p className="text-sm font-semibold text-champagne-gold">{track.theme}</p>}
      <p className="mt-2 text-sm leading-snug text-white/70">{track.summary}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {track.tags.map((tag) => (
          <li key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
            {tag}
          </li>
        ))}
      </ul>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={TRACK_CAP} aria-valuenow={track.picked} aria-label={`${track.picked} of ${TRACK_CAP} seats taken`}>
        <div
          className={`h-full rounded-full ${track.full ? "bg-danger" : "bg-gradient-to-r from-cyber-pink to-champagne-gold"}`}
          style={{ width: `${(track.picked / TRACK_CAP) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-white/45">
        <span>{track.picked} picked</span>
        <span>{TRACK_CAP} seats</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-white/70">
          {track.problemNote && (
            <p className="flex items-center gap-1.5">
              <Hourglass className="h-3.5 w-3.5 shrink-0 text-champagne-gold" aria-hidden="true" />
              <span>{track.problemNote}</span>
            </p>
          )}
          {track.pdfHref && (
            <a
              href={track.pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyber-pink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
            >
              View challenge PDF ↗
            </a>
          )}
        </div>
        {lockedLook ? (
          <Lock className="h-4 w-4 shrink-0 text-white/40" aria-label="Locked" />
        ) : opens ? (
          <span className="shrink-0 font-display text-[10px] tracking-[0.14em] text-champagne-gold">OPENS 9:30</span>
        ) : canSelect || track.full || mode === "picker" || mode === "paused" ? (
          <button
            type="button"
            data-testid={`select-${track.id}`}
            disabled={!canSelect}
            aria-pressed={selected}
            onClick={onSelect}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-display text-[10px] tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold disabled:cursor-not-allowed ${
              selected
                ? "border-cyber-pink bg-cyber-pink text-white"
                : track.full
                  ? "border-white/15 text-white/35"
                  : "border-white/20 text-white/80 hover:border-cyber-pink"
            }`}
          >
            {track.full ? "FULL" : selected ? (
              <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" aria-hidden="true" /> SELECTED</span>
            ) : (
              "SELECT"
            )}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Confirm({
  data,
  track,
  busy,
  attempt,
  lockError,
  holdRef,
  onCancel,
  onComplete,
}: {
  data: State;
  track: PublicTrack;
  busy: boolean;
  attempt: number;
  lockError: string | null;
  holdRef: React.RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const seat = track.nextSeat ?? track.picked + 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-void-black/80 px-4 py-24 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-[420px]">
        <p className="sr-only" id="confirm-title">Confirm track {track.id}</p>
        <div className="rounded-[28px] border border-cyber-pink/50 bg-deep-plum p-5 shadow-2xl">
          <p className="font-display text-[11px] tracking-[0.2em] text-white/45">TEAM</p>
          <p className="mt-1 font-display text-3xl font-black leading-none">{data.team?.name}</p>
          <p className="mt-4 font-display text-6xl font-black leading-none text-cyber-pink">{track.id}</p>
          <p className="mt-3 text-lg font-semibold leading-snug text-champagne-gold">{trackFullName(track)}</p>
          <div className="my-4 border-t border-dashed border-white/15" />
          <p className="font-display text-[11px] tracking-[0.2em] text-white/45">SEAT</p>
          <p className="font-display text-2xl font-black text-champagne-gold">#{seat} of {TRACK_CAP}</p>
        </div>
        <p className="mt-4 text-center text-sm text-white/70">{CONFIRM_FINAL}</p>
        <div className="mt-3" ref={holdRef}>
          <HoldToLock key={`${track.id}-${attempt}`} busy={busy} onComplete={onComplete} />
        </div>
        <p id="hold-to-lock-hint" className="mt-2 text-center text-xs text-white/45">
          Press and hold for 2 seconds. Releasing cancels. Keyboard: hold Space or Enter.
        </p>
        {lockError && (
          <p role="alert" className="mt-2 text-center text-sm text-danger">{lockError}</p>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 block w-full text-center text-sm text-champagne-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Success({ data, headingRef }: { data: State; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const pick = data.pick;
  if (!pick || !data.team) return null;
  const track = data.tracks.find((t) => t.id === pick.trackId);
  const name = track ? trackFullName(track) : pick.trackName;
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl font-black outline-none">
        You&apos;re in.
      </h1>
      <div className="relative mt-5 rounded-[28px] border border-cyber-pink/40 bg-deep-plum p-5">
        <span className="absolute right-4 top-4 -rotate-12 rounded border-2 border-soft-gold px-2 py-0.5 font-display text-[10px] tracking-[0.2em] text-soft-gold">
          LOCKED
        </span>
        <p className="font-display text-[11px] tracking-[0.2em] text-white/45">TEAM</p>
        <p className="mt-1 font-display text-3xl font-black leading-none">{data.team.name}</p>
        <p className="mt-4 font-display text-6xl font-black leading-none text-cyber-pink">{pick.trackId}</p>
        <p className="mt-3 pr-16 text-lg font-semibold leading-snug text-champagne-gold">{name}</p>
        <div className="my-4 border-t border-dashed border-white/15" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[11px] tracking-[0.2em] text-white/45">SEAT</p>
            <p className="font-display text-xl font-black text-champagne-gold">#{pick.seat} of {TRACK_CAP}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[11px] tracking-[0.2em] text-white/45">PICKED AT</p>
            <p className="text-sm text-pearl-white">{formatPickTime(pick.pickedAt)}</p>
          </div>
        </div>
      </div>
      {!data.viewer.isLead && (
        <p className="mt-4 text-sm text-white/70">Your lead locked this track for the team. It cannot be changed.</p>
      )}
      <p className="mt-4 flex items-start gap-2 text-sm text-white/75">
        <Radio className="mt-0.5 h-4 w-4 shrink-0 text-cyber-pink" aria-hidden="true" />
        <span>{componentsReadyLine(pick.trackId)}</span>
      </p>
      <p className="mt-6 font-display text-sm tracking-[0.14em] text-cyber-pink">{SUCCESS_SURPRISES}</p>
    </>
  );
}
