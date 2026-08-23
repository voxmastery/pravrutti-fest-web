"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEST } from "@/lib/pravrutti-data";
import { STATUS_COPY, AppStatus, PayStatus } from "@/lib/applications";
import { Loader2, Search, CalendarPlus, Hourglass, Check, RotateCcw, LogOut } from "lucide-react";

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

const TONE: Record<AppStatus, { chip: string; icon: typeof Check }> = {
  pending: { chip: "bg-[#BF8A1B]/20 border-[#BF8A1B]/50 text-[#F2D2AE]", icon: Hourglass },
  confirmed: { chip: "bg-[#D64D8D]/20 border-[#D64D8D]/50 text-[#D64D8D]", icon: Check },
  declined: { chip: "bg-[#4A1C3A]/40 border-[#4A1C3A] text-[#F7EEE4]/60", icon: RotateCcw },
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
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem("pravrutti.guest") ?? "null");
      if (g?.email) setEmail(g.email);
    } catch {
      /* no saved guest */
    }
  }, []);

  const lookup = useCallback(
    async (withEmail?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withEmail ? { email: withEmail } : {}),
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

  const signedIn = me.signedIn;
  const needsSignIn = me.authEnabled && !signedIn;

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
        ) : (
          <div className="flex gap-2 mb-8">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup(email)}
              placeholder="you@college.edu"
              className="bg-[#040616] border-[#4A1C3A] rounded-xl h-12 text-[#F7EEE4] font-sharetech placeholder:text-[#F7EEE4]/30 focus-visible:ring-[#D64D8D]"
            />
            <Button
              onClick={() => lookup(email)}
              disabled={loading || !email}
              className="rounded-xl h-12 px-6 text-xs font-orbitron font-black uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        )}

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
          <div className="text-center py-16 border border-dashed border-[#4A1C3A] rounded-3xl bg-[#150B1E]/30">
            <p className="font-orbitron font-black text-[#F7EEE4] mb-2">No applications yet</p>
            <p className="font-sharetech text-xs text-[#F7EEE4]/50">
              <a href="/events" className="text-[#F2D2AE] underline hover:text-[#D64D8D]">
                Browse the events
              </a>{" "}
              and apply — they&apos;ll show up here.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {apps?.map((a) => {
            const tone = TONE[a.status];
            const Icon = tone.icon;
            return (
              <div key={a.ticketId} className="border border-[#4A1C3A] rounded-3xl bg-[#150B1E]/60 p-6 cyber-box space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <a
                      href={`/events/${a.eventId}`}
                      className="font-orbitron font-black text-lg text-[#F7EEE4] hover:text-[#F2D2AE] transition-colors block truncate"
                    >
                      {a.eventName}
                    </a>
                    <p className="font-sharetech text-xs text-[#F7EEE4]/45 mt-1">{a.ticketId}</p>
                  </div>
                  <span
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-orbitron text-[10px] font-black uppercase tracking-widest ${tone.chip}`}
                  >
                    <Icon className="w-3 h-3" /> {STATUS_COPY[a.status].label}
                  </span>
                </div>

                <p className="font-sharetech text-xs text-[#F7EEE4]/65 leading-relaxed">
                  {STATUS_COPY[a.status].blurb}
                </p>

                {a.status === "confirmed" && a.qr && (
                  <div className="prize-ticket animate-ticket rounded-2xl px-5 pt-5 pb-4 text-[#0A0512]">
                    <p className="font-orbitron text-[9px] font-black uppercase tracking-[0.2em] text-[#721F4C]">
                      {FEST.name} · {FEST.dates}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.qr} alt={`Entry QR for ${a.eventName}`} className="w-40 h-40 mx-auto my-3" />
                    <div className="prize-ticket-perf pt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sharetech text-[9px] uppercase tracking-widest text-[#721F4C]">Admit</p>
                        <p className="font-orbitron font-black text-sm truncate">{a.name}</p>
                      </div>
                      <p className="font-orbitron font-black text-base tracking-wider text-[#AC355D] shrink-0">
                        {a.ticketId}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#4A1C3A]/60">
                  <p className="font-sharetech text-[11px] text-[#F7EEE4]/45 pt-3">
                    {a.payment === "not_required"
                      ? "Free entry"
                      : a.payment === "awaiting"
                      ? `${a.fee} — payment link coming`
                      : a.payment === "paid"
                      ? `${a.fee} paid`
                      : `${a.fee} refunded`}
                  </p>
                  {a.status === "confirmed" && (
                    <Button
                      variant="outline"
                      onClick={() => addToCalendar(a.eventName, a.ticketId)}
                      className="mt-3 rounded-xl h-9 border-[#4A1C3A] text-[#F2D2AE] hover:bg-[#150B1E] text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Add to calendar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
