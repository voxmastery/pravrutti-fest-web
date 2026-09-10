"use client";

import { useRef } from "react";
import {
  Cpu,
  Globe,
  Lightbulb,
  Settings,
  BookOpen,
  ToyBrick,
  Sparkles,
  Plane,
  Calculator,
  Layers,
  Code,
  Rocket,
  Users,
  Crown,
  Cog,
  Stethoscope,
  CircuitBoard,
} from "lucide-react";
import { useScrollReveal, useMousePosition } from "@/hooks/use-animations";
import { PALETTE } from "@/lib/palette";

const clubs = [
  { name: "AI Club", cat: "AI & ML", icon: Sparkles },
  { name: "Cynergy", cat: "Coding Club", icon: Cpu },
  { name: "Robotic Dept.", cat: "Robotics", icon: ToyBrick },
  { name: "Math Club", cat: "Mathematics", icon: Calculator },
  { name: "ComputeX", cat: "Computer Sci", icon: Code },
  { name: "Aeronyx", cat: "Aerospace", icon: Rocket },
  { name: "TSS", cat: "The Startup Society", icon: Users },
  { name: "LEADS", cat: "Leadership", icon: Crown },
  { name: "AeSI", cat: "Aeronautical", icon: Plane },
  { name: "ISTE", cat: "Technical Ed", icon: BookOpen },
  { name: "IMECHE", cat: "Mechanical", icon: Cog },
  { name: "IEEE", cat: "Global Chapter", icon: Globe },
  { name: "Civil Club", cat: "Civil Eng", icon: Layers },
  { name: "ASME", cat: "Mechanical", icon: Settings },
  { name: "Dental", cat: "Dental Sci", icon: Stethoscope },
  { name: "IIC", cat: "Institution Innovation Council", icon: Lightbulb },
  { name: "Circuitopia", cat: "Circuits", icon: CircuitBoard },
];

/**
 * One stat, counting up the first time it scrolls into view.
 *
 * `tabular-nums` and a reserved min-width stop the row from twitching sideways
 * as the digits change — without it, 7 → 17 → 100 shoves the label about while
 * you're reading it, which is the thing that makes counters feel cheap.
 */
function ClubCard({ club, index }: { club: typeof clubs[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition(ref);
  const Icon = club.icon;
  const accentColors = [PALETTE.cyberPink, PALETTE.champagneGold, PALETTE.softGold, PALETTE.electricMagenta];
  const accent = accentColors[index % accentColors.length];

  return (
    // Compact horizontal row. The previous stacked card was ~180px tall for an
    // icon and two short strings, so twelve of them ate most of a screen.
    <div
      ref={ref}
      className="reveal-up group relative flex items-center gap-3.5 p-3.5 rounded-xl border border-royal-wine bg-cosmic-purple/30 backdrop-blur-sm neon-border magnetic-card cursor-default overflow-hidden" style={{ transitionDelay: `${index * 40}ms` }}
    >
      {mouse.active && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none z-0" style={{
            background: `radial-gradient(150px circle at ${mouse.x * 100}% ${mouse.y * 100}%, ${accent}12, transparent 60%)`,
          }}
        />
      )}

      <div
        className="relative z-10 w-11 h-11 shrink-0 flex items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>

      <div className="relative z-10 min-w-0">
        <span className="block font-display font-black text-base text-pearl-white tracking-wide truncate group-hover:text-champagne-gold transition-colors">
          {club.name}
        </span>
        <span
          className="block text-[11px] tracking-[0.15em] uppercase font-bold mt-0.5 truncate" style={{ color: accent }}
        >
          {club.cat}
        </span>
      </div>

      {/* Bottom fill line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-royal-wine overflow-hidden">
        <div className="h-full w-0 group-hover:w-full transition-all duration-500" style={{ background: accent }} />
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const headerRef = useScrollReveal();

  return (
    <section className="relative py-20 lg:py-28 bg-midnight-navy overflow-hidden border-t border-royal-wine/40">
      <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-neon-purple/6 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-3 text-xs md:text-sm tracking-[0.28em] uppercase text-cyber-pink mb-6">
            <span className="w-10 h-px bg-neon-purple" />
            ALLIED FACTIONS
            <span className="w-10 h-px bg-neon-purple" />
          </span>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-wider">
            ASSOCIATED <span className="text-stroke">CLUBS</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-pearl-white/70 max-w-xl mx-auto">
            The student guilds and technical chapters at RUAS powering Pravrutti's events.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {clubs.map((club, i) => (
            <ClubCard key={club.name} club={club} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
export default IntegrationsSection;
