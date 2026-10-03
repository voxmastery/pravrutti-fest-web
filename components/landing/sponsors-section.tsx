"use client";

import { useEffect, useRef, useState } from "react";
import { sponsors } from "@/lib/pravrutti-data";
import { Rocket, CircuitBoard, Building2, ArrowUpRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-animations";

/* One line each. The old copy ran to ~90 characters, which wrapped to six
   lines of mono text inside a 220px column — sponsor credits are scanned, not
   read, so each is now a single clause that fits on two lines at any width. */
const sponsorMeta: Record<string, { icon: typeof Rocket; desc: string }> = {
  "PCB Cupid": { icon: CircuitBoard, desc: "Modular electronics and dev boards for makers" },
  "IEEE Smart Cities": { icon: Building2, desc: "IEEE's global smart-city technology initiative" },
  ElevenLabs: { icon: Rocket, desc: "AI voice and audio — Hacktivate's partner" },
};

function SponsorCard({ sponsor, index }: { sponsor: (typeof sponsors)[0]; index: number }) {
  const meta = sponsorMeta[sponsor.name] ?? { icon: Rocket, desc: "" };
  const Icon = meta.icon;
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  /* onError alone is not enough. The markup is server-rendered, so a missing
     file 404s while the page is still HTML and the handler is attached only
     at hydration — by which point the error has already been and gone. This
     asks the element directly once it exists: complete with no intrinsic
     width is a load that failed. */
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  /* A wordmark is the name, so it takes the name's place at a size it can
     be read at; the square box is for square marks. If the file fails, the
     card falls back to the ordinary icon-and-name layout. */
  const showWordmark = !!sponsor.wordmark && !!sponsor.logo && !broken;

  return (
    <a
      href={sponsor.website}
      target="_blank" rel="noopener noreferrer" style={{ transitionDelay: `${index * 70}ms` }}
      /* Row, not a tall card: the name sits beside the mark instead of under
         it, so "RUAS Incubator (RTBI)" and "GeeksforGeeks" stop wrapping to
         three lines. Whole row is the target — Fitts's Law. */
      /* h-full so a two-line description (KASSIA) doesn't leave its row
         taller than the others — consistent sizing within a tier is what
         stops a sponsor wall reading as ragged. */
      className="reveal-up group flex h-full items-start gap-4 rounded-2xl border border-royal-wine bg-cosmic-purple/40 p-5 transition-colors hover:border-cyber-pink/50 hover:bg-cosmic-purple/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-pink" >
      {/* The real mark when we have been given one, the category icon when we
          have not. Several sponsors point at logo files that were never
          shipped, and a broken image is worse than a clean glyph — so a file
          that fails to load falls back rather than leaving a torn box. */}
      {!showWordmark && (
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-neon-purple/20 transition-colors group-hover:bg-cyber-pink/20">
        {sponsor.logo && !broken ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={img}
            src={sponsor.logo}
            alt=""
            onError={() => setBroken(true)}
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <Icon className="h-5 w-5 text-champagne-gold transition-colors group-hover:text-cyber-pink" />
        )}
      </span>
      )}

      <span className="min-w-0 flex-1">
        {/* at 500, not Orbitron 900. The display face is 40% wider per
            glyph and was the reason the longer names broke. */}
        <span className="flex items-center gap-1.5">
          {showWordmark ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={img}
              src={sponsor.logo}
              alt={sponsor.name}
              onError={() => setBroken(true)}
              className="h-5 w-auto max-w-[75%] object-contain object-left"
            />
          ) : (
          <span className="truncate text-[17px] font-semibold text-pearl-white transition-colors group-hover:text-champagne-gold">
            {sponsor.name}
          </span>
          )}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-pearl-white/25 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cyber-pink" />
        </span>
        <span className="mt-1 block text-sm leading-snug text-pearl-white/55">
          {meta.desc}
        </span>
      </span>
    </a>
  );
}

export function SponsorsSection() {
  const headerRef = useScrollReveal();

  return (
    <section className="relative py-28 lg:py-36 bg-black overflow-hidden border-t border-royal-wine/40">
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-neon-purple/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-3 text-xs md:text-sm tracking-[0.28em] uppercase text-cyber-pink mb-6">
            <span className="w-10 h-px bg-neon-purple" />
            PARTNERS
            <span className="w-10 h-px bg-neon-purple" />
          </span>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-wider">
            OUR <span className="text-stroke">SPONSORS</span>
          </h2>
        </div>

        {/* Two sponsors: two cards side by side, centred, capped so they do not
            stretch into thin bars on a wide screen. flex-wrap still centres a
            short last row if more are added. */}
        <div className="flex flex-wrap justify-center gap-4">
          {sponsors.map((s, i) => (
            <div key={s.name} className="w-full sm:w-[calc(50%-8px)] sm:max-w-[440px]">
              <SponsorCard sponsor={s} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export default SponsorsSection;
