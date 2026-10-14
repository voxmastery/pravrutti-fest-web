"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import { FEST, events, eventId as slugify } from "@/lib/pravrutti-data";
import { STATUS_COPY, AppStatus, PayStatus, FEE_PER_HEAD } from "@/lib/applications";
import {
  isDiscoverize,
  discoverizeState,
  DISCOVERIZE_STATE_LABEL,
  DISCOVERIZE_STATE_BLURB,
  ABSTRACT_FORM_URL,
  DISCOVERIZE_SHORTLIST_CONGRATS,
  discoverizeMayFormTeam,
} from "@/lib/discoverize";
import { downloadEventIcs } from "@/lib/event-calendar";
import { EventPoster } from "@/components/event-poster";
import { TeamInviteCard, useMyTeam, useMyTeamState } from "@/components/team-invite-card";
import { DiscoverizeGroupCard } from "@/components/discoverize-group-card";
import { DiscoverizeFormTeam } from "@/components/discoverize-form-team";
import { TeamManage } from "@/components/team-manage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TicketValidityNote } from "@/components/ticket-validity-note";
import { HACKTIVATE_EVENT_ID } from "@/lib/track-pick";
import { Loader2, CalendarPlus, Hourglass, Check, RotateCcw, LogOut, MapPin, QrCode, ArrowLeft, Copy, Cpu } from "lucide-react";

type App = {
  ticketId: string;
  eventId: string;
  eventName: string;
  status: AppStatus;
  payment: PayStatus;
  fee: string;
  hasPaymentRef?: boolean;
  unanswered?: boolean;
  round?: {
    abstractSubmittedAt?: string;
    abstractSource?: "form" | "organiser";
    shortlistedAt?: string;
    shortlistedBy?: string;
    paymentSubmittedAt?: string;
  } | null;
  name: string;
  teamName?: string | null;
  teamCode?: string | null;
  appliedAt: string;
  /** The exact hall, sent only for confirmed applications. */
  venue: string | null;
  qr: string | null;
};

const TONE: Record<AppStatus, { chip: string; dot: string; icon: typeof Check }> = {
  pending: {
    chip: "bg-soft-gold/20 border-soft-gold/50 text-champagne-gold",
    dot: "bg-soft-gold border-soft-gold/40",
    icon: Hourglass,
  },
  confirmed: {
    chip: "bg-success/15 border-success/45 text-success-soft",
    dot: "bg-success border-success/40",
    icon: Check,
  },
  cancelled: {
    chip: "bg-white/[0.06] border-white/[0.12] text-white/50",
    dot: "bg-white/25 border-white/10",
    icon: RotateCcw,
  },
  declined: {
    chip: "bg-white/[0.06] border-white/[0.12] text-white/50",
    dot: "bg-white/25 border-white/10",
    icon: RotateCcw,
  },
};

function TicketTeamBlock({
  eventId,
  fallbackCode,
  fallbackName,
  viewerEmail,
  viewerName,
  live,
  showManage = true,
}: {
  eventId: string;
  fallbackCode: string;
  fallbackName?: string | null;
  viewerEmail: string;
  /** Named in the invite email when the lead adds somebody from here. */
  viewerName: string;
  /** Whether this registration still holds a place. A withdrawn or declined
      entry has no team left to add anybody to. */
  live: boolean;
  /** Discoverize draws Add a member inside its own status box, next to
      "Payment submitted · in review", so the lead does not have to find it
      under the team code. */
  showManage?: boolean;
}) {
  /* Bumped to re-read the roster after the lead removes somebody. */
  const [pulse, setPulse] = useState(0);
  const team = useMyTeam(eventId, true, pulse);
  const [copied, setCopied] = useState(false);

  if (team) {
    return (
      <div className="pt-1">
        <TeamInviteCard team={team} />
        {showManage ? (
          <TeamManage
            eventId={eventId}
            team={team}
            viewerEmail={viewerEmail}
            leadName={viewerName}
            canAdd={live}
            onChanged={() => setPulse((n) => n + 1)}
          />
        ) : null}
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fallbackCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* they can still select the code */
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-2 pt-0.5 min-w-0">
      <Button type="button" variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy team code" className="h-auto max-w-full gap-1.5 px-1 text-sm text-white/70 hover:bg-transparent hover:text-white">
        <span className="text-white/40 shrink-0">Team code</span>
        <span className="tracking-widest text-white break-all text-left">{fallbackCode}</span>
        {copied ? (
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}
      </Button>
      <span className="text-xs text-white/35 break-words min-w-0">
        {fallbackName ? `${fallbackName} · ` : ""}share so teammates can still join
      </span>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

export default function TicketPage() {
  const me = useIdentity();
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<App[] | null>(null);
  const [qrFor, setQrFor] = useState<App | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusEvent, setFocusEvent] = useState<string | null>(null);
  /* Withdrawing is offered only on a pending application. A confirmed one has
     a ticket already, and the rest are closed. */
  const [withdrawFor, setWithdrawFor] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("event");
    const fromHash = window.location.hash.replace(/^#/, "");
    setFocusEvent(fromQuery || fromHash || null);
  }, []);

  const lookup = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Lookup failed.");
        else setApps(data.applications);
      } catch {
        setError("Network dropped. Try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const withdraw = async (eventId: string) => {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const res = await fetch("/api/register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWithdrawError(data.error ?? "Couldn't withdraw. Try again in a moment.");
        setWithdrawing(false);
        return;
      }
      setWithdrawFor(null);
      setWithdrawing(false);
      await lookup();
    } catch {
      setWithdrawError("Network dropped. Try again.");
      setWithdrawing(false);
    }
  };

  // Signed in: load automatically, no typing required.
  useEffect(() => {
    if (me.signedIn) lookup();
  }, [me.signedIn, lookup]);

  const signedIn = me.signedIn && !!me.email;
  // This page shows a person their own applications, so it is sign-in only —
  // there is no typed-email fallback to impersonate someone through.
  const needsSignIn = !signedIn;

  const focused =
    focusEvent && apps
      ? apps.find((a) => a.eventId === focusEvent && a.status === "confirmed" && a.qr)
      : null;

  if (signedIn && focusEvent && !error && (loading || apps === null || focused)) {
    return (
      <main className="relative min-h-screen bg-midnight-navy overflow-x-hidden text-pearl-white flex flex-col">
        <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />
        <div className="relative z-10 sticky top-0 flex items-center gap-2 px-3 h-14 bg-midnight-navy/90 backdrop-blur-md border-b border-royal-wine">
          <a
            href={`/events/${encodeURIComponent(focusEvent)}`}
            aria-label="Back to event" className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-pearl-white/70 hover:text-champagne-gold hover:bg-cosmic-purple transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink" >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </a>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold text-pearl-white leading-tight">My Ticket</h1>
            <p className="text-xs text-pearl-white/50 truncate">
              {focused?.eventName ?? " "}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6">
          {focused?.qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={focused.qr}
                alt={`Entry QR for ${focused.eventName}`}
                className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl bg-pearl-white p-3" />
              <div className="text-center space-y-1">
                <p className="font-display text-base font-bold text-pearl-white">{focused.name}</p>
                <p className="text-sm text-pearl-white/50">{me.email}</p>
              </div>
              <TicketValidityNote eventName={focused.eventName} className="max-w-sm text-center" />
            </>
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-cyber-pink" />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[720px] mx-auto px-4 sm:px-6 py-28 lg:py-36 min-w-0">
        <div className="text-center mb-10 min-w-0">
          <span className="inline-flex items-center gap-3 text-xs font-display tracking-widest text-cyber-pink uppercase font-bold mb-5">
            <span className="w-8 h-px bg-neon-purple" />
            Your applications
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-display tracking-wider font-black mb-4 break-words">
            MY <span className="text-stroke">TICKETS</span>
          </h1>
          <p className="text-pearl-white/60">
            {signedIn
              ? "Every event you've applied to, and the QR for the ones that are confirmed." : me.authEnabled
              ? "Sign in with the Google account you applied with." : "Enter the email you applied with to see where each application stands."}
          </p>
        </div>

        {/* Identity bar */}
        {!me.ready ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-cyber-pink" />
          </div>
        ) : needsSignIn ? (
          <div className="p-8 border border-royal-wine rounded-3xl bg-cosmic-purple/60 cyber-box text-center space-y-5">
            <p className="text-sm text-pearl-white/70">
              Signing in keeps your ticket tied to your inbox — you can reopen it on any device, and nobody
              else can pull up your applications.
            </p>
            <Button
              onClick={me.signIn}
              className="w-full sm:w-auto rounded-xl h-12 px-8 bg-pearl-white hover:bg-white text-midnight-navy text-xs font-display font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-3" >
              <GoogleMark /> Continue with Google
            </Button>
          </div>
        ) : signedIn ? (
          <div className="flex items-center gap-3 p-3 sm:p-4 border border-royal-wine rounded-2xl bg-cosmic-purple/60 mb-8 min-w-0 overflow-hidden">
            {me.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={me.image} alt="" className="w-10 h-10 rounded-xl shrink-0" />
            ) : (
              <span className="w-10 h-10 shrink-0 rounded-xl bg-neon-purple text-champagne-gold font-display font-black flex items-center justify-center text-sm">
                {(me.name ?? "?")[0]}
              </span>
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="font-bold text-sm truncate">{me.name}</p>
              <p className="text-xs text-pearl-white/50 truncate">{me.email}</p>
            </div>
            <Button
              variant="outline" onClick={me.signOut}
              aria-label="Sign out"
              className="shrink-0 rounded-xl h-9 px-2.5 sm:px-3 border-royal-wine text-pearl-white/60 hover:bg-royal-wine/30 text-[10px] font-bold uppercase tracking-wider cursor-pointer" >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        ) : null}

        {error && (
          <p className="text-xs text-cyber-pink border border-cyber-pink/40 bg-cyber-pink/10 rounded-xl p-3 mb-6">
            {error}
          </p>
        )}

        {loading && signedIn && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-cyber-pink" />
          </div>
        )}

        {!loading && apps?.length === 0 && (
          <div className="text-center py-16 border border-white/[0.08] rounded-3xl bg-white/[0.04]">
            <p className="font-semibold text-white mb-1.5">No applications yet</p>
            <p className="text-sm text-white/50">
              <a href="/events" className="text-champagne-gold underline hover:text-cyber-pink">
                Browse the events
              </a>{" "}
              and apply — they&apos;ll show up here.
            </p>
          </div>
        )}

        {/* My Events — Luma groups by date on a timeline rail. We have no
            per-event dates yet (Event.day / Event.startsAt are unset), so the
            rail groups by application status instead. The moment days are
            filled in, GROUPS below becomes date-driven with no layout change. */}
        <div className="relative">
          {apps && apps.length > 0 && (
            <div className="absolute left-[5px] top-3 bottom-3 w-px bg-white/[0.08] pointer-events-none" />
          )}

          {(["confirmed", "pending", "cancelled", "declined"] as AppStatus[]).map((status) => {
            const group = apps?.filter((a) => a.status === status) ?? [];
            if (group.length === 0) return null;
            const tone = TONE[status];

            return (
              <section key={status} className="relative pl-7 pb-8 last:pb-0">
                <span className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${tone.dot}`} />
                <h2 className="text-sm font-medium text-white/50 mb-4">
                  {STATUS_COPY[status].label}
                  <span className="text-white/25"> · {group.length}</span>
                </h2>

                <div className="space-y-3">
                  {group.map((a) => {
                    const ev = events.find((e) => slugify(e.name) === a.eventId);
                    const Icon = tone.icon;
                    return (
                      <article
                        key={a.ticketId}
                        className="min-w-0 w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4 flex flex-col gap-3 hover:bg-white/[0.06] transition-colors" >
                        {/* Title row + poster only. Nested cards (team, pay,
                            track) sit full-width below so they are not crushed
                            into the column beside the poster on phones. */}
                        <div className="flex gap-3 sm:gap-4 min-w-0">
                          <div className="min-w-0 flex-1 space-y-2">
                            <span className={`inline-flex max-w-full items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${tone.chip}`}>
                              <Icon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{STATUS_COPY[a.status].label}</span>
                            </span>

                            <a
                              href={`/events/${a.eventId}`}
                              className="block font-semibold text-base text-white hover:text-champagne-gold transition-colors leading-snug break-words" >
                              {a.eventName}
                            </a>

                            <p className="flex items-start gap-1.5 text-sm text-white/50 min-w-0">
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span className="min-w-0 break-words">{a.venue ?? FEST.venue}</span>
                            </p>

                            <p className="text-sm text-white/40 break-words">
                              {a.payment === "not_required" ? "No payment due" : a.payment === "awaiting" ? `${a.fee} · pay online` : a.payment === "paid" ? `${a.fee} paid` : `${a.fee} refunded`}
                              <span className="text-white/25 break-all"> · {a.ticketId}</span>
                            </p>
                          </div>

                          <a href={`/events/${a.eventId}`} className="shrink-0 self-start">
                            <EventPoster
                              event={ev}
                              name={a.eventName}
                              className="w-16 h-16 sm:w-20 sm:h-20 md:w-[96px] md:h-[96px] rounded-xl border border-white/[0.08]" />
                          </a>
                        </div>

                        <div className="min-w-0 w-full space-y-2">
                          {(a.status === "confirmed" || a.status === "pending") && (
                            <TicketValidityNote eventName={a.eventName} />
                          )}

                          {/* Discoverize: free to enter, and what comes next
                              depends on how far through its rounds the team is.
                              Its own block, so no other ticket changes. */}
                          {isDiscoverize(a.eventId) && a.status !== "cancelled" && (
                            <DiscoverizeRow a={a} email={me.email} onChanged={() => lookup()} />
                          )}

                          {/* Left for the portal and never said how it went —
                              the question they lost with the tab. This is where
                              they come back to, so it has to lead somewhere. */}
                          {!isDiscoverize(a.eventId) && a.status === "pending" && a.payment === "awaiting" && a.unanswered && (
                            <a
                              href={`/events/${a.eventId}?finish=reference`}
                              className="block rounded-xl border border-soft-gold/30 bg-soft-gold/[0.07] px-3 py-2.5 text-[13px] text-white/75 leading-relaxed hover:border-soft-gold/50 transition-colors"
                            >
                              <span className="block text-champagne-gold font-medium">
                                Finish registration &amp; pay
                              </span>
                              <span className="block mt-1">
                                {a.teamName
                                  ? `${a.teamName} is on this event, but your own registration isn’t finished and the fee (${a.fee}) is still due.`
                                  : `Your registration isn’t finished and the fee (${a.fee}) is still due.`}{" "}
                                If you already paid, add the receipt from the same page.
                              </span>
                            </a>
                          )}
                          {/* Answered without an ID. Registered; the ID is an
                              optional extra that speeds the organiser's check,
                              so it is offered quietly and never pressed for. */}
                          {!isDiscoverize(a.eventId) &&
                            a.status === "pending" &&
                            a.payment === "awaiting" &&
                            !a.unanswered &&
                            a.hasPaymentRef === false && (
                              <a
                                href={`/events/${a.eventId}`}
                                className="block text-[12px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                              >
                                Have your Juno transaction ID? Add it (optional)
                              </a>
                            )}

                          {a.eventId === HACKTIVATE_EVENT_ID && (a.status === "confirmed" || a.status === "pending") && (
                            <a
                              href="/hacktivate/track"
                              className="flex items-start justify-between gap-3 min-w-0 rounded-xl border border-cyber-pink/40 bg-cyber-pink/10 px-3 py-2.5 transition-colors hover:border-cyber-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-champagne-gold">Pick your track</span>
                                <span className="mt-0.5 block text-[12px] leading-snug text-white/60 break-words">
                                  Opens 11 Oct, 10:00 AM IST. Your lead locks one track for the team.
                                </span>
                              </span>
                              <Cpu className="h-4 w-4 shrink-0 text-cyber-pink mt-0.5" aria-hidden="true" />
                            </a>
                          )}

                          {a.eventId === HACKTIVATE_EVENT_ID && a.status === "confirmed" && (
                            <a
                              href="/hacktivate/kit"
                              className="flex items-start justify-between gap-3 min-w-0 rounded-xl border border-soft-gold/35 bg-soft-gold/10 px-3 py-2.5 transition-colors hover:border-soft-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-gold"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-champagne-gold">Kit &amp; components</span>
                                <span className="mt-0.5 block text-[12px] leading-snug text-white/60 break-words">
                                  PCB Cupid claim instructions, Arduino setup, and the component list.
                                </span>
                              </span>
                              <Cpu className="h-4 w-4 shrink-0 text-soft-gold mt-0.5" aria-hidden="true" />
                            </a>
                          )}

                          {a.teamCode && a.status !== "declined" && (
                            <TicketTeamBlock
                              eventId={a.eventId}
                              fallbackCode={a.teamCode}
                              fallbackName={a.teamName}
                              viewerEmail={me.email ?? ""}
                              viewerName={a.name}
                              live={a.status === "pending" || a.status === "confirmed"}
                              showManage={!isDiscoverize(a.eventId)}
                            />
                          )}

                          {a.status === "confirmed" && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {a.qr && (
                                <Button
                                  onClick={() => setQrFor(a)}
                                  className="h-[34px] rounded-2xl bg-white text-black hover:bg-white/90 font-medium text-sm px-4 cursor-pointer" >
                                  <QrCode className="w-4 h-4 mr-1.5" /> My Ticket
                                </Button>
                              )}
                              <Button
                                variant="outline" onClick={() => downloadEventIcs(a.eventName, a.ticketId)}
                                className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm px-4 cursor-pointer" >
                                <CalendarPlus className="w-4 h-4 mr-1.5" /> Calendar
                              </Button>
                            </div>
                          )}

                          {a.status === "pending" && (
                            withdrawFor === a.ticketId ? (
                              <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-3 space-y-2.5 mt-1">
                                <p className="text-[13px] text-white/75 leading-relaxed">
                                  Withdraw your registration for {a.eventName}? Your place goes
                                  back to the event.
                                </p>
                                {/* The state this page shows is "not verified yet", which is
                                    not the same as "not paid". Someone who has paid and
                                    withdraws here loses the row their payment would have been
                                    matched to, so they are sent to a person instead. */}
                                {a.payment === "awaiting" && (
                                  <p className="text-[13px] text-soft-gold/90 leading-relaxed">
                                    If you have already paid, don&apos;t withdraw — your payment
                                    may still be being verified. Message the organisers instead.
                                  </p>
                                )}
                                {withdrawError && (
                                  <p className="text-[13px] text-danger-strong">{withdrawError}</p>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => { setWithdrawFor(null); setWithdrawError(null); }}
                                    disabled={withdrawing}
                                    className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-medium text-sm px-4 cursor-pointer" >
                                    Keep it
                                  </Button>
                                  <Button
                                    onClick={() => withdraw(a.eventId)}
                                    disabled={withdrawing}
                                    className="h-[34px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium text-sm px-4 cursor-pointer" >
                                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setWithdrawFor(a.ticketId); setWithdrawError(null); }}
                                className="text-xs text-white/35 hover:text-white/70 underline underline-offset-2 cursor-pointer pt-1" >
                                Withdraw this registration
                              </button>
                            )
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* QR on demand, the way Luma's "My Ticket" opens a scannable card
          rather than leaving the code sitting in the list. */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="w-[min(100%-2rem,340px)] max-w-[340px] rounded-2xl border border-white/[0.08] bg-cosmic-purple/95 backdrop-blur-xl text-white p-5 sm:p-6 overflow-hidden" >
          <DialogTitle className="font-semibold text-base text-center text-white leading-snug break-words px-6">
            {qrFor?.eventName}
          </DialogTitle>
          {qrFor?.qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrFor.qr}
              alt={`Entry QR for ${qrFor.eventName}`}
              className="w-52 h-52 mx-auto rounded-xl bg-white p-3" />
          )}
          <div className="text-center space-y-0.5 min-w-0 px-1">
            <p className="font-medium text-white break-words">{qrFor?.name}</p>
            <p className="text-sm text-white/50 break-all">{qrFor?.ticketId}</p>
          </div>
          {qrFor && <TicketValidityNote eventName={qrFor.eventName} className="text-center" />}
          <p className="text-xs text-white/40 text-center leading-relaxed">
            Show this at the registration desk. {FEST.venue}.
          </p>
        </DialogContent>
      </Dialog>

      <FooterSection />
    </main>
  );
}

/**
 * Where a Discoverize team stands, and the one thing it can do next.
 *
 * The state is derived from the row rather than stored, so this cannot show a
 * button the server would refuse: "Pay ₹200" appears only for a team the
 * judges shortlisted, and the endpoint behind it checks the same rule again.
 */
function DiscoverizeRow({ a, email, onChanged }: { a: App; email: string | null; onChanged: () => void }) {
  const roundRow = { status: a.status, payment: a.payment, round: a.round ?? undefined };
  const state = discoverizeState(roundRow);
  const live = a.status === "pending" || a.status === "confirmed";
  const [teamPulse, setTeamPulse] = useState(0);
  /* In review counts. Confirmed is not required — a shortlisted lead who has
     submitted the ₹200 is still pending until an organiser verifies it. */
  const { team, settled } = useMyTeamState(a.eventId, live && state !== "closed", teamPulse);
  const refreshTeam = () => {
    setTeamPulse((n) => n + 1);
    onChanged();
  };
  if (state === "closed") return null;
  const shortlisted = live && discoverizeMayFormTeam(roundRow);
  const showCreate = shortlisted && settled && !team;
  const showAdd = shortlisted && !!team?.isLead;

  const tone =
    state === "final_round_confirmed"
      ? "border-emerald-400/30 bg-emerald-400/[0.07]"
      : state === "payment_pending"
        ? "border-soft-gold/30 bg-soft-gold/[0.07]"
        : "border-white/[0.10] bg-white/[0.04]";

  return (
    <div className={`space-y-2.5 rounded-xl border px-3 py-2.5 min-w-0 overflow-hidden ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne-gold break-words">
        {DISCOVERIZE_STATE_LABEL[state]}
      </p>
      <p className="text-[13px] leading-relaxed text-white/70 break-words">{DISCOVERIZE_STATE_BLURB[state]}</p>

      {state === "registered" && (
        <a href={ABSTRACT_FORM_URL} target="_blank" rel="noopener noreferrer" className="block">
          <Button className="h-10 w-full rounded-xl bg-cyber-pink text-sm font-medium text-white hover:bg-electric-magenta">
            Submit abstract
          </Button>
        </a>
      )}

      {/* Shortlisted, and the payer still owes the team's ₹200: straight to
          the JUNO hand-off on the event page. Nobody else sees this. */}
      {state === "payment_pending" && (
        <div className="space-y-1.5">
          {/* The control has to be the link itself. A <button> nested in an
              <a> is invalid: the click lands on the button, which does not
              follow the href, and the lead is left on this site instead of
              the event page's JUNO hand-off. */}
          <Button asChild className="h-10 w-full rounded-xl bg-cyber-pink text-sm font-medium text-white hover:bg-electric-magenta">
            <a href={`/events/${a.eventId}?finish=pay`}>Pay ₹{FEE_PER_HEAD}</a>
          </Button>
          <p className="text-xs font-semibold text-emerald-400">{DISCOVERIZE_SHORTLIST_CONGRATS}</p>
        </div>
      )}

      {settled && !team && live && (
        <section className="space-y-2 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Your team</p>
          {showCreate ? (
            <DiscoverizeFormTeam eventId={a.eventId} email={email} onCreated={refreshTeam} />
          ) : (
            <p className="text-[12px] leading-relaxed text-white/55">
              {a.teamCode
                ? `No team record loaded for code ${a.teamCode}. Refresh this page.`
                : "No team on this entry yet. Once you're shortlisted you can name a team here and add teammates."}
            </p>
          )}
        </section>
      )}

      {showAdd && team && (
        <TeamManage
          eventId={a.eventId}
          team={team}
          viewerEmail={email ?? ""}
          leadName={a.name}
          canAdd
          onChanged={refreshTeam}
        />
      )}

      {/* At every stage, not just the first — a team that has submitted or
          been shortlisted needs the group more, not less. `closed` already
          returned above, and the server refuses a withdrawn team anyway. */}
      <DiscoverizeGroupCard compact />
    </div>
  );
}
