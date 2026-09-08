"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import Link from "next/link";
import { Calendar, Info, ArrowRight } from "lucide-react";
import { events, FEST } from "@/lib/pravrutti-data";

export default function SchedulePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-neon-purple/40" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-royal-wine/40" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-display tracking-widest text-cyber-pink uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-neon-purple" />
            ARENA STAGE MAP
            <span className="w-8 h-px bg-neon-purple" />
          </span>
          <h1 className="text-4xl md:text-7xl font-display tracking-wider text-pearl-white mb-6 font-black">
            PRAVRUTTI <span className="text-stroke">SCHEDULE</span>
          </h1>
          <p className="text-base md:text-xl text-pearl-white/70 leading-relaxed max-w-2xl mx-auto">
            Three days, 24 arenas. The day-by-day timetable is being finalised with the event coordinators.
          </p>
        </div>

        {/* Advisory Box */}
        <div className="max-w-2xl mx-auto mb-12 p-4 rounded-xl border border-cyber-pink/40 bg-cosmic-purple/90 flex gap-4 items-center justify-center shadow-xl shadow-neon-purple/15 cyber-box">
          <Info className="w-5 h-5 text-champagne-gold shrink-0" />
          <p className="text-sm md:text-base text-pearl-white/85 text-center">
            Venues are confirmed and shown on each event's page. Start times follow shortly.
          </p>
        </div>

        {/* The image that sat here was last year's: it read "15th–17th
            October 2025" and listed the previous roster (ElectroXcape,
            SkyHack, Wind Rush…), none of which run in 2026. A wrong schedule
            is worse than none, because it reads as authoritative — so it is
            replaced by an honest placeholder until the real one exists. */}
        <div className="relative border border-royal-wine rounded-3xl bg-cosmic-purple/60 backdrop-blur-md px-6 py-20 md:py-28 overflow-hidden shadow-2xl shadow-neon-purple/25 max-w-4xl mx-auto text-center cyber-box">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-neon-purple/40 text-champagne-gold grid place-items-center mb-6">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="font-display text-2xl md:text-3xl font-black tracking-wide text-pearl-white mb-3">
            SCHEDULE COMING SOON
          </h3>
          <p className="text-pearl-white/60 max-w-md mx-auto leading-relaxed">
            The day-by-day timetable for all {events.length} arenas is being finalised with
            the event coordinators. It lands here well before {FEST.dates}.
          </p>
          <Link
            href="/events" className="inline-flex items-center gap-2 mt-8 rounded-xl border border-royal-wine hover:border-cyber-pink px-5 h-11 font-display text-sm font-bold tracking-widest uppercase text-champagne-gold transition-colors" >
            Browse events <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
