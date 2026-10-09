"use client";

import { useEffect, useRef, useState } from "react";
import { sponsors, type Sponsor } from "@/lib/pravrutti-data";

/* Presentation only. Every name here sponsors the fest, not one arena.
   Event pages keep their own partner-perk copy. */
const sponsorMeta: Record<string, { role: string; mark?: "compact" }> = {
  ElevenLabs: { role: "AI voice and audio" },
  "Seeed Studio": { role: "Hardware" },
  "PCB Cupid": { role: "Components" },
  ".xyz": { role: "Domains", mark: "compact" },
  "IEEE Smart Cities": { role: "Smart cities" },
};

/** The order on the wall. Anyone added to the data list and missing here
    still appears, after these. */
const wallOrder = [
  "ElevenLabs",
  "Seeed Studio",
  "PCB Cupid",
  ".xyz",
  "IEEE Smart Cities",
];

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const meta = sponsorMeta[sponsor.name];
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  /* onError alone misses a 404 that happened during SSR, before hydration
     attached the handler. A complete image with no width is that failure. */
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  const showLogo = !!sponsor.logo && !broken;
  const compact = meta?.mark === "compact";

  return (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      /* No reveal-up. That class paints opacity 0 until an
         IntersectionObserver adds .revealed, so with no JS, before the
         observer fires, and in a headless capture, the card is invisible. */
      className="group flex h-full min-h-[10.5rem] flex-col items-center justify-center gap-5 rounded-2xl border border-royal-wine/80 bg-deep-plum px-6 py-7 text-center transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-champagne-gold/40 hover:shadow-[0_18px_40px_-24px_rgba(242,210,174,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-pink motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
    >
      <span className="flex h-16 w-full items-center justify-center">
        {showLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={img}
            src={sponsor.logo}
            alt={sponsor.name}
            onError={() => setBroken(true)}
            /* Same well for every mark. Wide wordmarks share a height; the
               .xyz bubble is short, so it is taller or it reads as a speck.
               Full white on the plum card; hover only brightens. */
            className={
              compact
                ? "h-14 w-auto max-w-[8.5rem] object-contain opacity-100 transition duration-300 group-hover:brightness-125 motion-reduce:transition-none"
                : "h-10 w-auto max-w-full object-contain opacity-100 transition duration-300 group-hover:brightness-125 motion-reduce:transition-none sm:h-11"
            }
          />
        ) : (
          <span className="text-balance font-display text-base font-bold uppercase leading-tight tracking-[0.12em] text-pearl-white sm:text-lg">
            {sponsor.name}
          </span>
        )}
      </span>
      {meta?.role && (
        <span className="block text-sm leading-snug text-pearl-white/60">
          {meta.role}
        </span>
      )}
    </a>
  );
}

export function SponsorsSection() {
  const byName = new Map(sponsors.map((s) => [s.name, s]));
  const ordered = [
    ...wallOrder.map((n) => byName.get(n)).filter((s): s is Sponsor => !!s),
    ...sponsors.filter((s) => !wallOrder.includes(s.name)),
  ];

  return (
    <section className="relative overflow-hidden border-t border-royal-wine/40 bg-black py-28 lg:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[640px] -translate-x-1/2 rounded-full bg-neon-purple/10 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="mx-auto mb-16 max-w-3xl text-center lg:mb-20">
          <span className="mb-6 inline-flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-cyber-pink md:text-sm">
            <span className="h-px w-10 bg-neon-purple" />
            PARTNERS
            <span className="h-px w-10 bg-neon-purple" />
          </span>
          <h2 className="font-display text-4xl font-black tracking-wider md:text-6xl">
            OUR <span className="text-stroke">SPONSORS</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-pearl-white/70 md:text-lg">
            The companies and communities backing Pravrutti 2.0.
          </p>
        </div>

        {/* justify-center wraps a short last row into the middle — three
            across on desktop leaves two, two across on a tablet leaves one. */}
        <div className="flex flex-wrap justify-center gap-4">
          {ordered.map((s) => (
            <div key={s.name} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
              <SponsorCard sponsor={s} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SponsorsSection;
