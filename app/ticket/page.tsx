"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import { FEST, events, eventId as slugify } from "@/lib/pravrutti-data";
import { STATUS_COPY, AppStatus, PayStatus } from "@/lib/applications";
import { EventPoster } from "@/components/event-poster";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CalendarPlus, Hourglass, Check, RotateCcw, LogOut, MapPin, QrCode } from "lucide-react";

type App = {
  ticketId: string;
  eventId: string;
  eventName: string;
  status: AppStatus;
  payment: PayStatus;
  fee: string;
  name: string;
  appliedAt: string;
  qr: string | null;
};

const TONE: Record<AppStatus, { chip: string; dot: string; icon: typeof Check }> = {
  pending: {
    chip: "bg-[#BF8A1B]/20 border-[#BF8A1B]/50 text-[#F2D2AE]",
    dot: "bg-[#BF8A1B] border-[#BF8A1B]/40",
    icon: Hourglass,
  },
  confirmed: {
    chip: "bg-[#12B76A]/15 border-[#12B76A]/45 text-[#7BE3A8]",
    dot: "bg-[#12B76A] border-[#12B76A]/40",
    icon: Check,
  },
  declined: {
    chip: "bg-white/[0.06] border-white/[0.12] text-white/50",
    dot: "bg-white/25 border-white/10",
    icon: RotateCcw,
  },
};

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

function addToCalendar(eventName: string, ticketId: string) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pravrutti//EN",
    "BEGIN:VEVENT",
    `UID:${ticketId}@pravrutti`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${FEST.startUtc}`,
    `DTEND:${FEST.endUtc}`,
    `SUMMARY:${eventName} - ${FEST.name}`,
    `LOCATION:${FEST.venue}`,
    `DESCRIPTION:Ticket ${ticketId}. Show your QR at the registration desk.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${eventName.replace(/\s+/g, "-")}.ics`;
  a.click();
}

export default function TicketPage() {
  const me = useIdentity();
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<App[] | null>(null);
  const [qrFor, setQrFor] = useState<App | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Signed in: load automatically, no typing required.
  useEffect(() => {
    if (me.signedIn) lookup();
  }, [me.signedIn, lookup]);

  const signedIn = me.signedIn && !!me.email;
  // This page shows a person their own applications, so it is sign-in only —
  // there is no typed-email fallback to impersonate someone through.
  const needsSignIn = !signedIn;

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[720px] mx-auto px-6 py-28 lg:py-36">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-3 text-xs font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-5">
            <span className="w-8 h-px bg-[#721F4C]" />
            Your applications
          </span>
          <h1 className="text-4xl md:text-6xl font-orbitron tracking-wider font-black mb-4">
            MY <span className="text-stroke">TICKETS</span>
          </h1>
          <p className="font-sharetech text-[#F7EEE4]/60">
            {signedIn
              ? "Every event you've applied to, and the QR for the ones that are confirmed."
              : me.authEnabled
              ? "Sign in with the Google account you applied with."
              : "Enter the email you applied with to see where each application stands."}
          </p>
        </div>

        {/* Identity bar */}
        {!me.ready ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#D64D8D]" />
          </div>
        ) : needsSignIn ? (
          <div className="p-8 border border-[#4A1C3A] rounded-3xl bg-[#150B1E]/60 cyber-box text-center space-y-5">
            <p className="font-sharetech text-sm text-[#F7EEE4]/70">
              Signing in keeps your ticket tied to your inbox — you can reopen it on any device, and nobody
              else can pull up your applications.
            </p>
            <Button
              onClick={me.signIn}
              className="w-full sm:w-auto rounded-xl h-12 px-8 bg-[#F7EEE4] hover:bg-white text-[#0A0512] text-xs font-orbitron font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-3"
            >
              <GoogleMark /> Continue with Google
            </Button>
          </div>
        ) : signedIn ? (
          <div className="flex items-center gap-3 p-4 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/60 mb-8">
            {me.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={me.image} alt="" className="w-10 h-10 rounded-xl shrink-0" />
            ) : (
              <span className="w-10 h-10 shrink-0 rounded-xl bg-[#721F4C] text-[#F2D2AE] font-orbitron font-black flex items-center justify-center text-sm">
                {(me.name ?? "?")[0]}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{me.name}</p>
              <p className="font-sharetech text-xs text-[#F7EEE4]/50 truncate">{me.email}</p>
            </div>
            <Button
              variant="outline"
              onClick={me.signOut}
              className="rounded-xl h-9 border-[#4A1C3A] text-[#F7EEE4]/60 hover:bg-[#4A1C3A]/30 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        ) : null}

        {error && (
          <p className="text-xs font-sharetech text-[#D64D8D] border border-[#D64D8D]/40 bg-[#D64D8D]/10 rounded-xl p-3 mb-6">
            {error}
          </p>
        )}

        {loading && signedIn && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#D64D8D]" />
          </div>
        )}

        {!loading && apps?.length === 0 && (
          <div className="text-center py-16 border border-white/[0.08] rounded-3xl bg-white/[0.04]">
            <p className="font-ui font-semibold text-white mb-1.5">No applications yet</p>
            <p className="font-ui text-sm text-white/50">
              <a href="/events" className="text-[#F2D2AE] underline hover:text-[#D64D8D]">
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

          {(["confirmed", "pending", "declined"] as AppStatus[]).map((status) => {
            const group = apps?.filter((a) => a.status === status) ?? [];
            if (group.length === 0) return null;
            const tone = TONE[status];

            return (
              <section key={status} className="relative pl-7 pb-8 last:pb-0">
                <span className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${tone.dot}`} />
                <h2 className="font-ui text-sm font-medium text-white/50 mb-4">
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
                        className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 flex gap-4 hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-ui text-xs font-medium ${tone.chip}`}>
                            <Icon className="w-3 h-3" /> {STATUS_COPY[a.status].label}
                          </span>

                          <a
                            href={`/events/${a.eventId}`}
                            className="block font-ui font-semibold text-base text-white hover:text-[#F2D2AE] transition-colors leading-snug"
                          >
                            {a.eventName}
                          </a>

                          <p className="flex items-center gap-1.5 font-ui text-sm text-white/50">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{ev?.venue ?? FEST.venue}</span>
                          </p>

                          <p className="font-ui text-sm text-white/40">
                            {a.payment === "not_required"
                              ? "Free entry"
                              : a.payment === "awaiting"
                              ? `${a.fee} · payment link coming`
                              : a.payment === "paid"
                              ? `${a.fee} paid`
                              : `${a.fee} refunded`}
                            <span className="text-white/25"> · {a.ticketId}</span>
                          </p>

                          {a.status === "confirmed" && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {a.qr && (
                                <Button
                                  onClick={() => setQrFor(a)}
                                  className="h-[34px] rounded-2xl bg-white text-black hover:bg-white/90 font-ui font-medium text-sm px-4 cursor-pointer"
                                >
                                  <QrCode className="w-4 h-4 mr-1.5" /> My Ticket
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => addToCalendar(a.eventName, a.ticketId)}
                                className="h-[34px] rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white font-ui font-medium text-sm px-4 cursor-pointer"
                              >
                                <CalendarPlus className="w-4 h-4 mr-1.5" /> Calendar
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Poster sits right, as it does on Luma's list rows */}
                        <a href={`/events/${a.eventId}`} className="shrink-0">
                          <EventPoster
                            event={ev}
                            name={a.eventName}
                            className="w-[80px] h-[80px] sm:w-[96px] sm:h-[96px] rounded-xl border border-white/[0.08]"
                          />
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
          className="max-w-[340px] rounded-2xl border border-white/[0.08] bg-[#141216]/95 backdrop-blur-xl text-white p-6 font-ui"
        >
          <DialogTitle className="font-ui font-semibold text-base text-center text-white leading-snug">
            {qrFor?.eventName}
          </DialogTitle>
          {qrFor?.qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrFor.qr}
              alt={`Entry QR for ${qrFor.eventName}`}
              className="w-52 h-52 mx-auto rounded-xl bg-white p-3"
            />
          )}
          <div className="text-center space-y-0.5">
            <p className="font-ui font-medium text-white">{qrFor?.name}</p>
            <p className="font-mono text-sm text-white/50">{qrFor?.ticketId}</p>
          </div>
          <p className="font-ui text-xs text-white/40 text-center leading-relaxed">
            Show this at the registration desk. {FEST.venue}.
          </p>
        </DialogContent>
      </Dialog>

      <FooterSection />
    </main>
  );
}
