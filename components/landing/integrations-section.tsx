"use client";

import { useRef, useState } from "react";
import { Cpu, Globe, Lightbulb, Settings, BookOpen, ToyBrick, Sparkles, Plane, Briefcase, Calculator, Layers, Code } from "lucide-react";
import { useScrollReveal, useMousePosition } from "@/hooks/use-animations";

const clubs = [
  { name: "Cynergy", cat: "Electronics", icon: Cpu },
  { name: "IEEE", cat: "Global Chapter", icon: Globe },
  { name: "IIC", cat: "Innovation", icon: Lightbulb },
  { name: "ASME", cat: "Mechanical", icon: Settings },
  { name: "ISTE", cat: "Technical Ed", icon: BookOpen },
  { name: "Robotics Club", cat: "Robotics", icon: ToyBrick },
  { name: "AI Club", cat: "AI & ML", icon: Sparkles },
  { name: "AIAA", cat: "Aerospace", icon: Plane },
  { name: "Startup Society", cat: "Incubator", icon: Briefcase },
  { name: "Math Club", cat: "Mathematics", icon: Calculator },
  { name: "Civil Club", cat: "Civil Eng", icon: Layers },
  { name: "ComputeX Club", cat: "Computer Sci", icon: Code },
];

function ClubCard({ club, index }: { club: typeof clubs[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition(ref);
  const Icon = club.icon;
  const accentColors = ["#D64D8D", "#F2D2AE", "#BF8A1B", "#AC355D"];
  const accent = accentColors[index % accentColors.length];

  return (
    // Compact horizontal row. The previous stacked card was ~180px tall for an
    // icon and two short strings, so twelve of them ate most of a screen.
    <div
      ref={ref}
      className="reveal-up group relative flex items-center gap-3.5 p-3.5 rounded-xl border border-[#4A1C3A] bg-[#150B1E]/30 backdrop-blur-sm neon-border magnetic-card cursor-default overflow-hidden"
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      {mouse.active && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none z-0"
          style={{
            background: `radial-gradient(150px circle at ${mouse.x * 100}% ${mouse.y * 100}%, ${accent}12, transparent 60%)`,
          }}
        />
      )}

      <div
        className="relative z-10 w-11 h-11 shrink-0 flex items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>

      <div className="relative z-10 min-w-0">
        <span className="block font-orbitron font-black text-base text-[#F7EEE4] tracking-wide truncate group-hover:text-[#F2D2AE] transition-colors">
          {club.name}
        </span>
        <span
          className="block font-mono text-[11px] tracking-[0.15em] uppercase font-bold mt-0.5 truncate"
          style={{ color: accent }}
        >
          {club.cat}
        </span>
      </div>

      {/* Bottom fill line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#4A1C3A] overflow-hidden">
        <div className="h-full w-0 group-hover:w-full transition-all duration-500" style={{ background: accent }} />
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const headerRef = useScrollReveal();
  const statsRef = useScrollReveal();

  return (
    <section className="relative py-20 lg:py-28 bg-[#0A0818] overflow-hidden border-t border-[#4A1C3A]/40">
      <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-[#721F4C]/6 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-3 font-mono text-xs md:text-sm tracking-[0.28em] uppercase text-[#D64D8D] mb-6">
            <span className="w-10 h-px bg-[#721F4C]" />
            ALLIED FACTIONS
            <span className="w-10 h-px bg-[#721F4C]" />
          </span>
          <h2 className="text-4xl md:text-6xl font-orbitron font-black tracking-wider">
            ASSOCIATED <span className="text-stroke">CLUBS</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-[#F7EEE4]/70 font-mono max-w-xl mx-auto">
            The student guilds and technical chapters at RUAS powering Pravrutti's events.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 mb-12">
          {clubs.map((club, i) => (
            <ClubCard key={club.name} club={club} index={i} />
          ))}
        </div>

        <div ref={statsRef} className="reveal-up flex flex-wrap items-center justify-center gap-12 pt-8 border-t border-[#4A1C3A]/40">
          {[
            { v: "20+", l: "Clubs", c: "text-[#F2D2AE]" },
            { v: "50+", l: "Faculty Advisors", c: "text-[#D64D8D]" },
            { v: "100+", l: "Coordinators", c: "text-[#BF8A1B]" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className={`text-3xl font-orbitron font-black ${s.c}`}>{s.v}</div>
              <div className="text-xs font-mono tracking-[0.2em] text-[#F7EEE4]/60 uppercase mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export default IntegrationsSection;
