import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { EventRegisterPanel } from "@/components/event-register-panel";
import { Button } from "@/components/ui/button";
import { events, eventId, FEST, formatINR, teamLabel } from "@/lib/pravrutti-data";
import { ArrowLeft, Download, Phone, Trophy } from "lucide-react";

export function generateStaticParams() {
  return events.map((e) => ({ slug: eventId(e.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = events.find((e) => eventId(e.name) === slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.name} · ${FEST.name}`,
    description: event.description.slice(0, 155),
    openGraph: {
      title: `${event.name} · ${FEST.name}`,
      description: event.description.slice(0, 155),
    },
  };
}

/** 1st / 2nd / 3rd … as far as the event actually awards. */
const PLACES = ["1st", "2nd", "3rd", "4th", "5th"];

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = events.find((e) => eventId(e.name) === slug);
  if (!event) notFound();

  const prizes = event.prizes;

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />

      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1100px] mx-auto px-6 py-28 lg:py-36">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-xs font-orbitron uppercase tracking-widest text-[#F7EEE4]/50 hover:text-[#D64D8D] transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All events
        </Link>

        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-10">
          {/* Left: the cabinet marquee + details */}
          <div className="space-y-8">
            <div className="relative p-8 border border-[#4A1C3A] rounded-3xl bg-gradient-to-br from-[#2B122C] via-[#150B1E] to-[#040616] cyber-box overflow-hidden">
              <div className="absolute inset-0 opacity-[0.15] pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="absolute h-px bg-[#D64D8D]" style={{ top: `${(i + 1) * 16}%`, left: 0, right: 0 }} />
                ))}
              </div>
              <div className="relative space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-orbitron font-black uppercase tracking-widest bg-[#721F4C]/50 text-[#F2D2AE] border border-[#4A1C3A]">
                    {event.category}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-orbitron font-black uppercase tracking-widest bg-[#D64D8D]/20 text-[#D64D8D] border border-[#D64D8D]/40">
                    {teamLabel(event)}
                  </span>
                </div>
                <h1 className="text-4xl md:text-6xl font-orbitron font-black tracking-wider text-[#F7EEE4] leading-[1.05]">
                  {event.name}
                </h1>
                <p className="font-sharetech text-sm text-[#D64D8D] uppercase tracking-widest">{event.subCategory}</p>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="font-orbitron text-xs uppercase tracking-widest text-[#F7EEE4]/45 font-black">About this event</h2>
              <p className="font-sharetech text-[#F7EEE4]/75 leading-relaxed">{event.description}</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-orbitron text-xs uppercase tracking-widest text-[#F7EEE4]/45 font-black flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-[#BF8A1B]" /> Prize pool
              </h2>
              {/* Prize count varies per event — render only what's awarded. */}
              <div className={`grid gap-3 ${prizes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {prizes.map((amount, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl bg-[#150B1E]/60 border text-center ${
                      i === 0 ? "text-[#F2D2AE] border-[#BF8A1B]/40" : "text-[#F7EEE4] border-[#4A1C3A]"
                    }`}
                  >
                    <p className="font-sharetech text-[10px] uppercase tracking-widest text-[#F7EEE4]/40">{PLACES[i]}</p>
                    <p className="font-orbitron font-black text-lg mt-1">{formatINR(amount)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-orbitron text-xs uppercase tracking-widest text-[#F7EEE4]/45 font-black">Hosted by</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[...event.coordinators.faculty.map((c) => ({ ...c, role: "Faculty coordinator" })),
                  ...event.coordinators.student.map((c) => ({ ...c, role: "Student coordinator" }))].map((c) => (
                  <div key={c.name + c.phone} className="p-4 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/50 flex items-center gap-3">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-[#721F4C]/60 border border-[#4A1C3A] text-[#F2D2AE] font-orbitron font-black text-xs flex items-center justify-center">
                      {c.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{c.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#F7EEE4]/40 font-orbitron">{c.role}</p>
                    </div>
                    <a href={`tel:${c.phone}`} className="text-[#D64D8D] hover:text-[#F2D2AE] p-2" aria-label={`Call ${c.name}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </section>

            <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`} className="block">
              <Button
                variant="outline"
                className="w-full rounded-xl h-12 border-[#4A1C3A] text-[#F2D2AE] hover:bg-[#150B1E] text-xs font-orbitron font-bold uppercase tracking-widest cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" /> Download rulebook
              </Button>
            </a>
          </div>

          {/* Right: registration */}
          <div>
            <EventRegisterPanel event={event} />
          </div>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
