"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import {
  getMyRegistrations,
  STATUS_META,
  TONE_CLASSES,
  type Registration,
} from "@/lib/registrations";
import {
  Ticket,
  Mail,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  Inbox,
} from "lucide-react";

/** The three-step explanation of what happens after you register. */
const FLOW = [
  {
    icon: CreditCard,
    title: "You register and pay",
    body: "Pick your events, submit your team details, and complete the entry payment. Free events skip this step entirely.",
  },
  {
    icon: Clock,
    title: "We verify your payment",
    body: "Your registration sits at “in process” while the committee verifies the payment against our records. This usually takes 24–48 hours.",
  },
  {
    icon: Mail,
    title: "You get a confirmation email",
    body: "Once your payment has been confirmed, you will receive an email confirmation at the address you registered with. That email is your proof of entry — keep it.",
  },
];

function RegistrationCard({ reg }: { reg: Registration }) {
  const meta = STATUS_META[reg.status];

  return (
    <div className="relative rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/60 backdrop-blur-sm overflow-hidden cyber-box">
      <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-15" />

      <div className="relative p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl md:text-2xl font-orbitron font-extrabold text-[#F7EEE4] tracking-wide">
              {reg.eventName}
            </h3>
            <span className="block mt-1.5 text-xs font-mono tracking-widest uppercase text-[#D64D8D] font-bold">
              {reg.eventCategory}
              {reg.teamName ? ` · ${reg.teamName}` : ""}
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-orbitron font-black uppercase ${TONE_CLASSES[meta.tone]}`}
          >
            {meta.label}
          </span>
        </div>

        {/* What happens next — the whole point of the status. */}
        <p className="text-base text-[#F7EEE4]/80 leading-relaxed font-sharetech">
          {meta.detail}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#4A1C3A]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#F7EEE4]/60">
              Amount
            </span>
            <span
              className={`font-orbitron text-lg font-black uppercase ${
                reg.amount.toLowerCase().startsWith("free")
                  ? "text-[#7BE3A8]"
                  : "text-[#F2D2AE]"
              }`}
            >
              {reg.amount}
            </span>
          </div>

          {reg.ticketCode && (
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#D64D8D]" />
              <span className="font-mono text-lg font-bold text-[#F2D2AE] tracking-wider">
                {reg.ticketCode}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);

  useEffect(() => {
    setIsVisible(true);
    let alive = true;
    getMyRegistrations().then((r) => {
      if (alive) setRegistrations(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[#000000] overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-[#721F4C]/40"
            style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-[#4A1C3A]/40"
            style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1000px] mx-auto px-6 py-32 lg:py-40">
        {/* Header — eyebrow dashes balanced on both sides, matching every other page */}
        <div
          className={`mb-14 text-center transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-[#721F4C]" />
            YOUR APPLICATIONS
            <span className="w-8 h-px bg-[#721F4C]" />
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            MY <span className="text-stroke">TICKETS</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-2xl mx-auto font-sharetech">
            Track the status of every event you have applied to, and see exactly what
            happens next.
          </p>
        </div>

        {/* Registrations, or the empty state */}
        <div className="space-y-5 mb-16">
          {registrations === null ? (
            <div className="text-center py-16 border border-dashed border-[#4A1C3A] rounded-2xl bg-[#150B1E]/30">
              <p className="font-mono text-sm text-[#F7EEE4]/60 uppercase tracking-widest animate-pulse">
                Loading your registrations…
              </p>
            </div>
          ) : registrations.length > 0 ? (
            registrations.map((reg) => <RegistrationCard key={reg.id} reg={reg} />)
          ) : (
            <div className="text-center py-16 px-6 border border-dashed border-[#4A1C3A] rounded-2xl bg-[#150B1E]/30 cyber-box">
              <Inbox className="w-10 h-10 text-[#D64D8D] mx-auto mb-5" />
              <h2 className="text-xl md:text-2xl font-orbitron font-black text-[#F7EEE4] mb-3">
                NO REGISTRATIONS YET
              </h2>
              <p className="text-base text-[#F7EEE4]/70 font-sharetech max-w-md mx-auto leading-relaxed mb-7">
                Once you register for an event, it will appear here along with its payment
                status. Already registered? Your confirmation is sent by email — check your
                inbox and spam folder.
              </p>
              <Link href="/events">
                <Button className="arcade-btn-primary rounded-xl font-orbitron text-sm px-8 py-5 h-auto font-black tracking-wider cursor-pointer">
                  BROWSE EVENTS <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* How registration works — shown always, because this is the answer to
            "my registration is in process, now what?" */}
        <section className="rounded-2xl border border-[#721F4C] bg-[#150B1E]/60 backdrop-blur-md overflow-hidden cyber-box">
          <div className="relative flex items-center gap-3 px-6 py-4 border-b border-[#4A1C3A] bg-[#0A0818]/80">
            <CheckCircle2 className="w-5 h-5 text-[#F2D2AE] shrink-0" />
            <h2 className="font-orbitron text-base md:text-lg font-black tracking-wider text-[#F7EEE4] uppercase">
              What happens after you register
            </h2>
          </div>

          <ol className="divide-y divide-[#4A1C3A]/60">
            {FLOW.map((step, i) => (
              <li key={step.title} className="flex gap-4 px-6 py-5">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-[#721F4C]/30 border border-[#D64D8D]/30 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-[#F2D2AE]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-orbitron text-base md:text-lg font-extrabold text-[#F7EEE4] tracking-wide mb-1.5">
                    <span className="text-[#D64D8D] mr-2">0{i + 1}</span>
                    {step.title}
                  </h3>
                  <p className="text-base text-[#F7EEE4]/75 leading-relaxed font-sharetech">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="px-6 py-5 border-t border-[#4A1C3A] bg-[#0A0818]/60">
            <p className="text-base text-[#F7EEE4]/70 font-sharetech leading-relaxed">
              Haven&apos;t received your confirmation email 48 hours after paying? Check your
              spam folder first, then{" "}
              <Link href="/contact" className="font-bold text-[#F2D2AE] underline hover:text-white">
                contact the organising helpdesk
              </Link>{" "}
              with your payment reference.
            </p>
          </div>
        </section>
      </div>

      <FooterSection />
    </main>
  );
}
