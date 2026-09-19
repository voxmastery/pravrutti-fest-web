"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import { FEST, events, eventId as slugify } from "@/lib/pravrutti-data";
import { STATUS_COPY, AppStatus, PayStatus } from "@/lib/applications";
import { downloadEventIcs } from "@/lib/event-calendar";
import { EventPoster } from "@/components/event-poster";
import { TeamInviteCard, useMyTeam } from "@/components/team-invite-card";
import { TeamManage } from "@/components/team-manage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CalendarPlus, Hourglass, Check, RotateCcw, LogOut, MapPin, QrCode, ArrowLeft, Copy } from "lucide-react";

type App = {
  ticketId: string;
  eventId: string;
  eventName: string;
  status: AppStatus;
  payment: PayStatus;
  fee: string;
  hasPaymentRef?: boolean;
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
}: {
  eventId: string;
  fallbackCode: string;
  fallbackName?: string | null;
  viewerEmail: string;
}) {
  /* Bumped to re-read the roster after the lead removes somebody. */
  const [pulse, setPulse] = useState(0);
  const team = useMyTeam(eventId, true, pulse);
  const [copied, setCopied] = useState(false);

  if (team) {
    return (
      <div className="pt-1">
        <TeamInviteCard team={team} />
        <TeamManage
          eventId={eventId}
          team={team}
          viewerEmail={viewerEmail}
          onChanged={() => setPulse((n) => n + 1)}
        />
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
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <Button type="button" variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy team code" className="h-auto gap-1.5 px-1 text-sm text-white/70 hover:bg-transparent hover:text-white">
        <span className="text-white/40">Team code</span>
        <span className="tracking-widest text-white">{fallbackCode}</span>
        {copied ? (
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </Button>
      <span className="text-xs text-white/35">
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

      <div className="relative z-10 flex-1 w-full max-w-[720px] mx-auto px-6 py-28 lg:py-36">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-3 text-xs font-display tracking-widest text-cyber-pink uppercase font-bold mb-5">
            <span className="w-8 h-px bg-neon-purple" />
            Your applications
          </span>
          <h1 className="text-4xl md:text-6xl font-display tracking-wider font-black mb-4">
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
          <div className="flex items-center gap-3 p-4 border border-royal-wine rounded-2xl bg-cosmic-purple/60 mb-8">
            {me.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={me.image} alt="" className="w-10 h-10 rounded-xl shrink-0" />
            ) : (
              <span className="w-10 h-10 shrink-0 rounded-xl bg-neon-purple text-champagne-gold font-display font-black flex items-center justify-center text-sm">
                {(me.name ?? "?")[0]}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{me.name}</p>
              <p className="text-xs text-pearl-white/50 truncate">{me.email}</p>
            </div>
            <Button
              variant="outline" onClick={me.signOut}
              className="rounded-xl h-9 border-royal-wine text-pearl-white/60 hover:bg-royal-wine/30 text-[10px] font-bold uppercase tracking-wider cursor-pointer" >
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
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
                        className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 flex gap-4 hover:bg-white/[0.06] transition-colors" >
                        <div className="min-w-0 flex-1 space-y-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${tone.chip}`}>
                            <Icon className="w-3 h-3" /> {STATUS_COPY[a.status].label}
                          </span>

                          <a
                            href={`/events/${a.eventId}`}
                            className="block font-semibold text-base text-white hover:text-champagne-gold transition-colors leading-snug" >
                            {a.eventName}
                          </a>

                          <p className="flex items-center gap-1.5 text-sm text-white/50">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{a.venue ?? FEST.venue}</span>
                          </p>

                          <p className="text-sm text-white/40">
                            {a.payment === "not_required" ? "No payment due" : a.payment === "awaiting" ? `${a.fee} · pay online` : a.payment === "paid" ? `${a.fee} paid` : `${a.fee} refunded`}
                            <span className="text-white/25"> · {a.ticketId}</span>
                          </p>

                          {/* Paid, but nothing recorded to verify it against.
                              They either lost the tab that asked for the
                              transaction ID, or said they could not find it
                              and have since. Either way this is where they
                              come back to, so it has to lead somewhere. */}
                          {a.status === "pending" &&
                            a.payment === "awaiting" &&
                            a.hasPaymentRef === false && (
                              <a
                                href={`/events/${a.eventId}`}
                                className="block rounded-xl border border-soft-gold/30 bg-soft-gold/[0.07] px-3 py-2.5 text-[13px] text-white/75 leading-relaxed hover:border-soft-gold/50 transition-colors"
                              >
                                No transaction ID recorded for this one yet. Your place is held —{" "}
                                <span className="text-champagne-gold font-medium underline underline-offset-2">
                                  add it here
                                </span>{" "}
                                once you have it from your payment receipt, so the organisers can
                                verify your payment.
                              </a>
                            )}

                          {a.teamCode && a.status !== "declined" && (
                            <TicketTeamBlock
                              eventId={a.eventId}
                              fallbackCode={a.teamCode}
                              fallbackName={a.teamName}
                              viewerEmail={me.email ?? ""}
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

                        {/* Poster sits right, as it does on Luma's list rows */}
                        <a href={`/events/${a.eventId}`} className="shrink-0">
                          <EventPoster
                            event={ev}
                            name={a.eventName}
                            className="w-[80px] h-[80px] sm:w-[96px] sm:h-[96px] rounded-xl border border-white/[0.08]" />
                        </a>
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
          className="max-w-[340px] rounded-2xl border border-white/[0.08] bg-cosmic-purple/95 backdrop-blur-xl text-white p-6" >
          <DialogTitle className="font-semibold text-base text-center text-white leading-snug">
            {qrFor?.eventName}
          </DialogTitle>
          {qrFor?.qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrFor.qr}
              alt={`Entry QR for ${qrFor.eventName}`}
              className="w-52 h-52 mx-auto rounded-xl bg-white p-3" />
          )}
          <div className="text-center space-y-0.5">
            <p className="font-medium text-white">{qrFor?.name}</p>
            <p className="text-sm text-white/50">{qrFor?.ticketId}</p>
          </div>
          <p className="text-xs text-white/40 text-center leading-relaxed">
            Show this at the registration desk. {FEST.venue}.
          </p>
        </DialogContent>
      </Dialog>

      <FooterSection />
    </main>
  );
}
