"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Info } from "lucide-react";

export default function SchedulePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
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

      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-xs font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-[#721F4C]" />
            ARENA STAGE MAP
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            PRAVRUTTI <span className="text-stroke">SCHEDULE</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-2xl mx-auto font-sharetech">
            Map out your symposium roadmap. Check dates, venue lobbies, and level time slots across all 3 days.
          </p>
        </div>

        {/* Advisory Box */}
        <div className="max-w-2xl mx-auto mb-12 p-4 rounded-xl border border-[#D64D8D]/40 bg-[#150B1E]/90 flex gap-4 items-center justify-center shadow-xl shadow-[#721F4C]/15 cyber-box">
          <Info className="w-5 h-5 text-[#F2D2AE] shrink-0" />
          <p className="text-xs md:text-sm text-[#F7EEE4]/80 text-center font-sharetech">
            Timings are subject to minor adjustments on event day. Please reach venues 15 mins prior.
          </p>
        </div>

        {/* Schedule Display Card inside cyber-box bezel */}
        <div className="relative border border-[#4A1C3A] rounded-3xl bg-[#150B1E]/60 backdrop-blur-md p-4 md:p-8 overflow-hidden shadow-2xl shadow-[#721F4C]/25 max-w-4xl mx-auto space-y-6 cyber-box">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-[#4A1C3A] font-orbitron">
            <div className="flex items-center gap-3">
              <div className="p-3.5 rounded-xl bg-[#721F4C]/40 text-[#F2D2AE]">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#F7EEE4] tracking-wide">Official Level Map</h3>
                <p className="text-xs text-[#D64D8D] font-mono uppercase tracking-widest font-bold mt-1">15th, 16th &amp; 17th October 2026</p>
              </div>
            </div>

            <a href="/Schedule.jpeg" download="Pravrutti_Schedule_2026.jpeg">
              <Button size="sm" className="rounded-xl text-white font-orbitron text-xs px-6 h-11 cursor-pointer font-bold uppercase tracking-widest arcade-btn-magenta border-[#D64D8D] hover:text-white">
                <Download className="w-4 h-4 mr-2" /> DOWNLOAD MAP
              </Button>
            </a>
          </div>

          {/* Schedule Image Container */}
          <div className="relative rounded-2xl overflow-hidden border border-[#721F4C]/50 bg-[#040616]">
            <img
              src="/Schedule.jpeg"
              alt="Pravrutti Techfest Event Schedule Map"
              className="w-full h-auto object-contain mx-auto"
            />
          </div>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
