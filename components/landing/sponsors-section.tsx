"use client";

import { sponsors } from "@/lib/pravrutti-data";
import { ShieldCheck, GraduationCap, Code, Rocket, Landmark, ArrowUpRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-animations";

/* One line each. The old copy ran to ~90 characters, which wrapped to six
   lines of mono text inside a 220px column — sponsor credits are scanned, not
   read, so each is now a single clause that fits on two lines at any width. */
const sponsorMeta: Record<string, { icon: typeof Rocket; desc: string }> = {
  "RUAS Incubator (RTBI)": { icon: Rocket, desc: "Ramaiah's startup incubator" },
  KASSIA: { icon: Landmark, desc: "Karnataka Small Scale Industries Association" },
  Jamboree: { icon: GraduationCap, desc: "Global education and admissions" },
  GeeksforGeeks: { icon: Code, desc: "Coding prep, courses and CS resources" },
  Unstop: { icon: ShieldCheck, desc: "Competitions and campus hiring" },
};

function SponsorCard({ sponsor, index }: { sponsor: (typeof sponsors)[0]; index: number }) {
  const meta = sponsorMeta[sponsor.name] ?? { icon: Rocket, desc: "" };
  const Icon = meta.icon;

  return (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      style={{ transitionDelay: `${index * 70}ms` }}
      /* Row, not a tall card: the name sits beside the mark instead of under
         it, so "RUAS Incubator (RTBI)" and "GeeksforGeeks" stop wrapping to
         three lines. Whole row is the target — Fitts's Law. */
      /* h-full so a two-line description (KASSIA) doesn't leave its row
         taller than the others — consistent sizing within a tier is what
         stops a sponsor wall reading as ragged. */
      className="reveal-up group flex h-full items-start gap-4 rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/40 p-5 transition-colors hover:border-[#D64D8D]/50 hover:bg-[#150B1E]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D64D8D]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#721F4C]/20 transition-colors group-hover:bg-[#D64D8D]/20">
        <Icon className="h-5 w-5 text-[#F2D2AE] transition-colors group-hover:text-[#D64D8D]" />
      </span>

      <span className="min-w-0 flex-1">
        {/* font-ui at 500, not Orbitron 900. The display face is 40% wider per
            glyph and was the reason the longer names broke. */}
        <span className="flex items-center gap-1.5">
          <span className="truncate font-ui text-[17px] font-semibold text-[#F7EEE4] transition-colors group-hover:text-[#F2D2AE]">
            {sponsor.name}
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#F7EEE4]/25 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#D64D8D]" />
        </span>
        <span className="mt-1 block font-ui text-sm leading-snug text-[#F7EEE4]/55">
          {meta.desc}
        </span>
      </span>
    </a>
  );
}

export function SponsorsSection() {
  const headerRef = useScrollReveal();

  return (
    <section className="relative py-28 lg:py-36 bg-black overflow-hidden border-t border-[#4A1C3A]/40">
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-[#721F4C]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-3 font-mono text-xs md:text-sm tracking-[0.28em] uppercase text-[#D64D8D] mb-6">
            <span className="w-10 h-px bg-[#721F4C]" />
            PARTNERS
            <span className="w-10 h-px bg-[#721F4C]" />
          </span>
          <h2 className="text-4xl md:text-6xl font-orbitron font-black tracking-wider">
            OUR <span className="text-stroke">SPONSORS</span>
          </h2>
        </div>

        {/* flex-wrap rather than a 5-column grid: five cards in five columns
            gave each 220px, and the trailing row of a 3-col grid hangs left.
            This centres the last two. */}
        <div className="flex flex-wrap justify-center gap-4">
          {sponsors.map((s, i) => (
            <div key={s.name} className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]">
              <SponsorCard sponsor={s} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export default SponsorsSection;
