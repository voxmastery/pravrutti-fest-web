"use client";

import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { GallerySection } from "@/components/landing/gallery-section";
import { Users, Zap, Target } from "lucide-react";
import { useEffect, useState } from "react";

export default function AboutPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

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

      {/* Scanline overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-16 lg:mb-24 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6">
            <span className="w-8 h-px bg-[#721F4C]" />
            RESTORED LOG FILE
            <span className="w-8 h-px bg-[#721F4C]" />
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            ABOUT <span className="text-stroke">PRAVRUTTI 2.0</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-3xl font-sharetech">
            PRAVRUTTI is RUAS' flagship technical symposium—a national stage celebrating student tech, logic, and creativity, styled as a virtual terminal archiving the future.
          </p>
        </div>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-start mb-24">
          <div className="space-y-6 font-sharetech">
            <h2 className="text-2xl md:text-3xl font-orbitron uppercase tracking-wider text-[#F2D2AE] font-extrabold">CORE PROTOCOL</h2>
            <p className="text-lg md:text-xl italic text-[#D64D8D] border-l-2 border-[#AC355D] pl-4 py-1 font-semibold">
              &ldquo;Fueling Innovation. Celebrating Talent. Inspiring Change.&rdquo;
            </p>
            <p className="text-base md:text-lg text-[#F7EEE4]/75 leading-relaxed">
              At Ramaiah University of Applied Sciences (RUAS), we believe education goes beyond classrooms—it is about nurturing curiosity, creativity, and leadership. Through Pravrutti, our flagship national-level fest, we envision creating a platform where students from across the country come together to innovate, collaborate, and lead.
            </p>
            <p className="text-base md:text-lg text-[#F7EEE4]/75 leading-relaxed">
              More than just competitions, Pravrutti reflects RUAS' commitment to applied learning, interdisciplinary problem-solving, and entrepreneurial growth. It is our vision to empower students to push boundaries, embrace challenges, and contribute meaningfully to society—shaping the next generation of leaders, innovators, and changemakers.
            </p>
          </div>
          
          {/* Fest dossier.
              Replaces a floating logo-in-a-box that read as a placeholder: this states
              the facts a visitor actually wants next to the vision copy, in the same
              terminal-readout language as the rest of the page. */}
          <div className="relative rounded-2xl overflow-hidden border border-[#721F4C] bg-[#150B1E]/80 backdrop-blur-md shadow-2xl shadow-[#721F4C]/20 cyber-box">
            <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-20" />

            {/* Terminal title bar */}
            <div className="relative flex items-center justify-between gap-3 px-5 py-3 border-b border-[#4A1C3A] bg-[#0A0818]/80">
              <span className="font-mono text-xs tracking-[0.28em] uppercase text-[#F2D2AE]">
                fest_dossier
              </span>
              <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#F7EEE4]/60">
                <span className="w-2 h-2 rounded-full bg-[#D64D8D] animate-pulse" />
                Live
              </span>
            </div>

            <dl className="relative divide-y divide-[#4A1C3A]/60">
              {[
                { k: "Edition", v: "Pravrutti 2.0" },
                { k: "Dates", v: "15–17 October 2026" },
                { k: "Venue", v: "RUAS Peenya Campus, Bengaluru" },
                { k: "Events", v: "25+ technical arenas" },
                { k: "Prize Pool", v: "₹2,00,000+", accent: true },
                { k: "Expected", v: "5,000+ participants" },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                  <dt className="font-mono text-xs sm:text-sm uppercase tracking-[0.18em] text-[#D64D8D] shrink-0">
                    {row.k}
                  </dt>
                  <dd
                    className={`text-right font-sharetech text-base sm:text-lg ${
                      row.accent ? "text-[#F2D2AE] font-bold text-xl sm:text-2xl font-orbitron" : "text-[#F7EEE4]"
                    }`}
                  >
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Host attribution — the university mark, but as a footer credit
                rather than a floating emblem. */}
            <div className="relative flex items-center gap-3 px-5 py-4 border-t border-[#4A1C3A] bg-[#0A0818]/60">
              <img
                src="/ruas-logo-naac.png"
                alt="Ramaiah University of Applied Sciences — NAAC A+ accredited"
                className="h-8 w-auto object-contain shrink-0"
                width={907}
                height={259}
              />
              <span className="font-sharetech text-xs sm:text-sm text-[#F7EEE4]/60 leading-snug">
                Hosted by Ramaiah University of Applied Sciences
              </span>
            </div>
          </div>
        </div>

        {/* Pillars Grid in cyber-box brackets */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              icon: Users,
              title: "COMMUNITY",
              description: "Connecting over 5,000 students, professionals, and enthusiasts from across the country."
            },
            {
              icon: Zap,
              title: "INNOVATION",
              description: "Featuring 25+ events that curates innovation in every braincell."
            },
            {
              icon: Target,
              title: "OPPORTUNITY",
              description: "Providing a platform to network with industry leaders and explore future career paths."
            }
          ].map((pillar, i) => (
            <div 
              key={pillar.title} 
              className="p-8 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/60 backdrop-blur-sm hover:border-[#D64D8D] transition-all duration-300 group hover:shadow-xl hover:shadow-[#D64D8D]/15 cyber-box"
            >
              <div className="p-3.5 rounded-xl bg-[#721F4C]/30 text-[#F2D2AE] inline-block mb-6 group-hover:bg-[#D64D8D] group-hover:text-white transition-all duration-300">
                <pillar.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl md:text-2xl font-orbitron font-extrabold text-[#F7EEE4] mb-3 tracking-wide">{pillar.title}</h3>
              <p className="text-base text-[#F7EEE4]/70 leading-relaxed font-sharetech">{pillar.description}</p>
            </div>
          ))}
        </div>

        {/* Previous-year gallery */}
        <GallerySection />
      </div>

      <FooterSection />
    </main>
  );
}
