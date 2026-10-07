"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { events } from "@/lib/pravrutti-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, FileText, ArrowDownToLine } from "lucide-react";

export default function DownloadsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const filteredEvents = events.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            DOWNLOAD ARCHIVE
            <span className="w-8 h-px bg-neon-purple" />
          </span>
          <h1 className="text-4xl md:text-7xl font-display tracking-wider text-pearl-white mb-6 font-black">
            DOWNLOAD <span className="text-stroke">RULEBOOKS</span>
          </h1>
          <p className="text-base md:text-xl text-pearl-white/70 leading-relaxed max-w-2xl mx-auto">
            Access detailed stage specifications, rules parameters, and level controls for all {events.length} events.
          </p>
        </div>

        {/* Featured Main Brochure Box in cyber-box bezel */}
        <div className="mb-12 p-8 border border-neon-purple bg-cosmic-purple/80 backdrop-blur-md rounded-3xl max-w-3xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-neon-purple/25 cyber-box">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-neon-purple/45 text-champagne-gold">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-extrabold text-pearl-white tracking-wide">Pravrutti Main ROM</h3>
              <p className="text-sm text-cyber-pink uppercase tracking-widest mt-1.5 font-bold">Complete Overview &amp; General Regulations</p>
            </div>
          </div>
          <a href="/Pravrutti_Main_Brochure.pdf" download="Pravrutti_Main_Brochure.pdf">
            <Button size="lg" className="rounded-xl text-white font-display text-sm px-8 h-12 cursor-pointer font-bold uppercase tracking-widest arcade-btn-magenta border-cyber-pink hover:text-white">
              <ArrowDownToLine className="w-4 h-4 mr-2" /> DOWNLOAD ROM
            </Button>
          </a>
        </div>

        {/* Search Input */}
        <div className="max-w-md mx-auto mb-12">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-pink" />
            <Input
              placeholder="Search level database by event or domain..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2 border-royal-wine bg-cosmic-purple/95 backdrop-blur-sm rounded-full text-base focus:border-cyber-pink focus:ring-0 focus-visible:ring-0 h-11 text-pearl-white" />
          </div>
        </div>

        {/* Downloads Grid inside cyber-box frames */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div
              key={event.name}
              className="p-6 border border-royal-wine rounded-2xl bg-cosmic-purple/50 backdrop-blur-sm hover:border-cyber-pink transition-all duration-300 flex flex-col justify-between space-y-4 group cyber-box arcade-card-hover" >
              <div>
                <span className="text-xs font-display text-cyber-pink uppercase tracking-widest block font-bold">{event.category}</span>
                <h3 className="text-xl font-display font-extrabold text-pearl-white group-hover:text-champagne-gold transition-colors mt-1.5 tracking-wide">
                  {event.name}
                </h3>
                <span className="text-sm text-pearl-white/65 block mt-1">{event.subCategory}</span>
              </div>

              <div className="pt-4 border-t border-royal-wine flex justify-between items-center font-display">
                <span
                  className={`font-display text-base font-black uppercase ${
                    event.fee.toLowerCase().startsWith("free") ? "text-success-soft" : "text-champagne-gold" }`}
                >
                  {event.fee}
                </span>
                {event.brochureUrl ? (
                  <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`}>
                    <Button
                      size="sm" className="rounded-xl border border-neon-purple text-pearl-white font-bold text-sm cursor-pointer h-11 px-4 arcade-btn hover:border-cyber-pink hover:text-white" >
                      <Download className="w-3.5 h-3.5 mr-1 text-cyber-pink" /> ROM GUIDE
                    </Button>
                  </a>
                ) : (
                  <span className="text-xs text-pearl-white/35">Rulebook to come</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
