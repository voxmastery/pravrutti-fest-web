"use client";

import { useRef } from "react";
import { sponsors } from "@/lib/pravrutti-data";
import { ShieldCheck, GraduationCap, Code, Rocket, Landmark, ExternalLink } from "lucide-react";
import { useScrollReveal, useMousePosition } from "@/hooks/use-animations";

const sponsorMeta: Record<string, { icon: any; desc: string }> = {
  "RUAS Incubator (RTBI)": { icon: Rocket, desc: "Ramaiah Technology Business Incubator — backing entrepreneurial dreams and startup ideas." },
  "KASSIA": { icon: Landmark, desc: "Karnataka Small Scale Industries Association — fueling industrial partnership." },
  "Jamboree": { icon: GraduationCap, desc: "India's leading global education partner for international admissions." },
  "GeeksforGeeks": { icon: Code, desc: "The ultimate CS portal — coding prep, courses, and engineering resources." },
  "Unstop": { icon: ShieldCheck, desc: "The premier competition platform connecting students with companies." },
};

function SponsorCard({ sponsor, index }: { sponsor: typeof sponsors[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition(ref);
  const meta = sponsorMeta[sponsor.name] || { icon: Rocket, desc: "" };
  const Icon = meta.icon;

  return (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <div
        ref={ref}
        className="reveal-up group relative p-7 rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/40 backdrop-blur-sm neon-border magnetic-card h-full flex flex-col"
        style={{ transitionDelay: `${index * 100}ms` }}
      >
        {mouse.active && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none z-0"
            style={{
              background: `radial-gradient(200px circle at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(214, 77, 141, 0.08), transparent 60%)`,
            }}
          />
        )}

        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#721F4C]/20 flex items-center justify-center group-hover:bg-[#D64D8D]/20 transition-colors">
              <Icon className="w-5 h-5 text-[#F2D2AE] group-hover:text-[#D64D8D] transition-colors" />
            </div>
            <ExternalLink className="w-4 h-4 text-[#F7EEE4]/20 group-hover:text-[#F2D2AE] transition-colors" />
          </div>

          <h3 className="text-xl font-orbitron font-black text-[#F7EEE4] group-hover:text-[#F2D2AE] transition-colors tracking-wider mb-2">
            {sponsor.name}
          </h3>
          <p className="text-sm text-[#F7EEE4]/65 leading-relaxed font-mono flex-1">{meta.desc}</p>

          <div className="mt-6 pt-4 border-t border-[#4A1C3A]/40 font-mono text-xs tracking-[0.2em] uppercase text-[#D64D8D]/80 group-hover:text-[#D64D8D] transition-colors">
            Visit Website →
          </div>
        </div>
      </div>
    </a>
  );
}

export function SponsorsSection() {
  const headerRef = useScrollReveal();

  return (
    <section className="relative py-28 lg:py-36 bg-black overflow-hidden border-t border-[#4A1C3A]/40">
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-[#721F4C]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-20">
          <span className="inline-flex items-center gap-3 font-mono text-xs md:text-sm tracking-[0.28em] uppercase text-[#D64D8D] mb-6">
            <span className="w-10 h-px bg-[#721F4C]" />
            PARTNERS
            <span className="w-10 h-px bg-[#721F4C]" />
          </span>
          <h2 className="text-4xl md:text-6xl font-orbitron font-black tracking-wider">
            OUR <span className="text-stroke">SPONSORS</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {sponsors.map((s, i) => (
            <SponsorCard key={s.name} sponsor={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
export default SponsorsSection;
