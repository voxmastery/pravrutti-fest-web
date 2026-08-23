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
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
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
          <span className="inline-flex items-center gap-3 text-sm font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-[#721F4C]" />
            DOWNLOAD ARCHIVE
            <span className="w-8 h-px bg-[#721F4C]" />
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            DOWNLOAD <span className="text-stroke">RULEBOOKS</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-2xl mx-auto font-sharetech">
            Access detailed stage specifications, rules parameters, and level controls for all 25+ events.
          </p>
        </div>

        {/* Featured Main Brochure Box in cyber-box bezel */}
        <div className="mb-12 p-8 border border-[#721F4C] bg-[#150B1E]/80 backdrop-blur-md rounded-3xl max-w-3xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-[#721F4C]/25 cyber-box">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-[#721F4C]/45 text-[#F2D2AE]">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-orbitron font-extrabold text-[#F7EEE4] tracking-wide">Pravrutti Main ROM</h3>
              <p className="text-sm text-[#D64D8D] font-mono uppercase tracking-widest mt-1.5 font-bold">Complete Overview &amp; General Regulations</p>
            </div>
          </div>
          <a href="/Pravrutti_Main_Brochure.pdf" download="Pravrutti_Main_Brochure.pdf">
            <Button size="lg" className="rounded-xl text-white font-orbitron text-sm px-8 h-12 cursor-pointer font-bold uppercase tracking-widest arcade-btn-magenta border-[#D64D8D] hover:text-white">
              <ArrowDownToLine className="w-4 h-4 mr-2" /> DOWNLOAD ROM
            </Button>
          </a>
        </div>

        {/* Search Input */}
        <div className="max-w-md mx-auto mb-12">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D64D8D]" />
            <Input
              placeholder="Search level database by event or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2 border-[#4A1C3A] bg-[#150B1E]/95 backdrop-blur-sm rounded-full text-base font-sharetech focus:border-[#D64D8D] focus:ring-0 focus-visible:ring-0 h-11 text-[#F7EEE4]"
            />
          </div>
        </div>

        {/* Downloads Grid inside cyber-box frames */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div
              key={event.name}
              className="p-6 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/50 backdrop-blur-sm hover:border-[#D64D8D] transition-all duration-300 flex flex-col justify-between space-y-4 group cyber-box arcade-card-hover"
            >
              <div>
                <span className="text-xs font-orbitron text-[#D64D8D] uppercase tracking-widest block font-bold">{event.category}</span>
                <h3 className="text-xl font-orbitron font-extrabold text-[#F7EEE4] group-hover:text-[#F2D2AE] transition-colors mt-1.5 tracking-wide">
                  {event.name}
                </h3>
                <span className="text-sm text-[#F7EEE4]/65 font-sharetech block mt-1">{event.subCategory}</span>
              </div>

              <div className="pt-4 border-t border-[#4A1C3A] flex justify-between items-center font-orbitron">
                <span
                  className={`font-orbitron text-base font-black uppercase ${
                    event.fee.toLowerCase().startsWith("free") ? "text-[#7BE3A8]" : "text-[#F2D2AE]"
                  }`}
                >
                  {event.fee}
                </span>
                <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`}>
                  <Button
                    size="sm"
                    className="rounded-xl border border-[#721F4C] text-[#F7EEE4] font-bold text-sm cursor-pointer h-11 px-4 arcade-btn hover:border-[#D64D8D] hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-[#D64D8D]" /> ROM GUIDE
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
