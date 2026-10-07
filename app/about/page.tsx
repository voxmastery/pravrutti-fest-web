"use client";

import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Users, Zap, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { formatINR, ANNOUNCED_PRIZE_POOL, events } from "@/lib/pravrutti-data";

export default function AboutPage() {
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

      {/* Scanline overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-16 lg:mb-24 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-display tracking-widest text-cyber-pink uppercase font-bold mb-6">
            <span className="w-8 h-px bg-neon-purple" />
            RESTORED LOG FILE
            <span className="w-8 h-px bg-neon-purple" />
          </span>
          <h1 className="text-4xl md:text-7xl font-display tracking-wider text-pearl-white mb-6 font-black">
            ABOUT <span className="text-stroke">PRAVRUTTI 2.0</span>
          </h1>
          <p className="text-base md:text-xl text-pearl-white/70 leading-relaxed max-w-3xl">
            PRAVRUTTI is RUAS' flagship technical symposium—a national stage celebrating student tech, logic, and creativity, styled as a virtual terminal archiving the future.
          </p>
        </div>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-start mb-24">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-display uppercase tracking-wider text-champagne-gold font-extrabold">CORE PROTOCOL</h2>
            <p className="text-lg md:text-xl italic text-cyber-pink border-l-2 border-electric-magenta pl-4 py-1 font-semibold">
              &ldquo;Fueling Innovation. Celebrating Talent. Inspiring Change.&rdquo;
            </p>
            <p className="text-base md:text-lg text-pearl-white/75 leading-relaxed">
              At Ramaiah University of Applied Sciences (RUAS), we believe education goes beyond classrooms—it is about nurturing curiosity, creativity, and leadership. Through Pravrutti, our flagship national-level fest, we envision creating a platform where students from across the country come together to innovate, collaborate, and lead.
            </p>
            <p className="text-base md:text-lg text-pearl-white/75 leading-relaxed">
              More than just competitions, Pravrutti reflects RUAS' commitment to applied learning, interdisciplinary problem-solving, and entrepreneurial growth. It is our vision to empower students to push boundaries, embrace challenges, and contribute meaningfully to society—shaping the next generation of leaders, innovators, and changemakers.
            </p>
          </div>
          
          {/* Fest dossier.
              Replaces a floating logo-in-a-box that read as a placeholder: this states
              the facts a visitor actually wants next to the vision copy, in the same
              terminal-readout language as the rest of the page. */}
          <div className="relative rounded-2xl overflow-hidden border border-neon-purple bg-cosmic-purple/80 backdrop-blur-md shadow-2xl shadow-neon-purple/20 cyber-box">
            <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-20" />

            {/* Terminal title bar */}
            <div className="relative flex items-center justify-between gap-3 px-5 py-3 border-b border-royal-wine bg-midnight-navy/80">
              <span className="text-xs tracking-[0.28em] uppercase text-champagne-gold">
                fest_dossier
              </span>
              <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-pearl-white/60">
                <span className="w-2 h-2 rounded-full bg-cyber-pink animate-pulse" />
                Live
              </span>
            </div>

            <dl className="relative divide-y divide-royal-wine/60">
              {[
                { k: "Edition", v: "Pravrutti 2.0" },
                { k: "Dates", v: "14–16 October 2026" },
                { k: "Venue", v: "Ramaiah Technology Campus, Bengaluru" },
                { k: "Events", v: `${events.length} technical arenas` },
                { k: "Prize Pool", v: formatINR(ANNOUNCED_PRIZE_POOL), accent: true },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                  <dt className="text-xs sm:text-sm uppercase tracking-[0.18em] text-cyber-pink shrink-0">
                    {row.k}
                  </dt>
                  <dd
                    className={`text-right text-base sm:text-lg ${
                      row.accent ? "text-champagne-gold font-bold text-xl sm:text-2xl font-display" : "text-pearl-white" }`}
                  >
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Pillars Grid in cyber-box brackets */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              icon: Users,
              title: "COMMUNITY",
              description: "Bringing together students, professionals, and enthusiasts from colleges across the country." },
            {
              icon: Zap,
              title: "INNOVATION",
              description: `Featuring ${events.length} events that curates innovation in every braincell.` },
            {
              icon: Target,
              title: "OPPORTUNITY",
              description: "Providing a platform to network with industry leaders and explore future career paths." }
          ].map((pillar, i) => (
            <div 
              key={pillar.title} 
              className="p-8 border border-royal-wine rounded-2xl bg-cosmic-purple/60 backdrop-blur-sm hover:border-cyber-pink transition-all duration-300 group hover:shadow-xl hover:shadow-cyber-pink/15 cyber-box" >
              <div className="p-3.5 rounded-xl bg-neon-purple/30 text-champagne-gold inline-block mb-6 group-hover:bg-cyber-pink group-hover:text-white transition-all duration-300">
                <pillar.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl md:text-2xl font-display font-extrabold text-pearl-white mb-3 tracking-wide">{pillar.title}</h3>
              <p className="text-base text-pearl-white/70 leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
