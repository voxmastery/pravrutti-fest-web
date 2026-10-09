"use client";

import { useEffect, useRef, useState } from "react";
import { sponsors, type Sponsor } from "@/lib/pravrutti-data";

/* Presentation only. The sponsor records (name, logo, website) stay in
   pravrutti-data; this is how the homepage groups and captions them.
   Hacktivate's page already names PCB Cupid as its component partner, so
   they sit with that arena. IEEE Smart Cities is not tied to one event. */
const sponsorMeta: Record<string, { event: string; role: string; mark?: "compact" }> = {
  ElevenLabs: { event: "Hacktivate", role: "AI voice and audio" },
  "Seeed Studio": { event: "Hacktivate", role: "Hardware sponsor" },
  "PCB Cupid": { event: "Hacktivate", role: "Component partner" },
  ".xyz": { event: "CHAOS", role: "Free first-year domains", mark: "compact" },
  "IEEE Smart Cities": { event: "Community", role: "Smart-city initiative" },
};

const groups: { id: string; label: string; note: string; names: string[] }[] = [
  {
    id: "hacktivate",
    label: "Hacktivate",
    note: "Predictive systems",
    names: ["ElevenLabs", "Seeed Studio", "PCB Cupid"],
  },
  {
    id: "chaos",
    label: "CHAOS",
    note: "Software hackathon",
    names: [".xyz"],
  },
  {
    id: "community",
    label: "Community",
    note: "Across the fest",
    names: ["IEEE Smart Cities"],
  },
];

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const meta = sponsorMeta[sponsor.name] ?? { event: "Partners", role: "" };
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  /* onError alone misses a 404 that happened during SSR, before hydration
     attached the handler. A complete image with no width is that failure. */
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  const showLogo = !!sponsor.logo && !broken;
  const compact = meta.mark === "compact";

  return (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      /* No reveal-up. That class paints opacity 0 until an
         IntersectionObserver adds .revealed, so with no JS, before the
         observer fires, and in a headless capture, the card is invisible.
         The mark has to be on the page in the default stylesheet. */
      className="group flex h-full min-h-[11.25rem] flex-col items-center justify-between rounded-2xl border border-royal-wine/80 bg-deep-plum px-6 py-6 text-center transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-champagne-gold/40 hover:shadow-[0_18px_40px_-24px_rgba(242,210,174,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-pink motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
    >
      <span className="flex min-h-16 w-full items-center justify-center">
        {showLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={img}
            src={sponsor.logo}
            alt={sponsor.name}
            onError={() => setBroken(true)}
            /* One well for every mark. Wide wordmarks share a height; the
               .xyz bubble is short and square, so it is taller or it reads
               as a speck next to ElevenLabs. They are full-white on the plum
               card; hover only brightens them. */
            className={
              compact
                ? "h-14 w-auto max-w-[8.5rem] object-contain opacity-100 transition duration-300 group-hover:brightness-125 motion-reduce:transition-none"
                : "h-10 w-auto max-w-full object-contain opacity-100 transition duration-300 group-hover:brightness-125 motion-reduce:transition-none sm:h-11"
            }
          />
        ) : (
          <span className="text-balance font-display text-base font-bold uppercase leading-tight tracking-[0.12em] text-pearl-white/90 transition-colors duration-300 group-hover:text-champagne-gold motion-reduce:transition-none sm:text-lg">
            {sponsor.name}
          </span>
        )}
      </span>
      <span className="mt-4 block">
        <span className="block font-display text-[10px] font-bold uppercase tracking-[0.24em] text-champagne-gold">
          {meta.event}
        </span>
        {meta.role && (
          <span className="mt-1.5 block text-sm leading-snug text-pearl-white/55">
            {meta.role}
          </span>
        )}
      </span>
    </a>
  );
}

export function SponsorsSection() {
  const byName = new Map(sponsors.map((s) => [s.name, s]));
  const placed = new Set(groups.flatMap((g) => g.names));
  const rows = groups.map((g) => ({
    ...g,
    sponsors: g.names.map((n) => byName.get(n)).filter((s): s is Sponsor => !!s),
  }));
  const rest = sponsors.filter((s) => !placed.has(s.name));
  if (rest.length) {
    rows.push({ id: "partners", label: "Partners", note: "", names: rest.map((s) => s.name), sponsors: rest });
  }

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
            The companies and communities backing Hacktivate, CHAOS, and the fest.
          </p>
        </div>

        <div className="space-y-14 lg:space-y-16">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-royal-wine/50 pb-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.28em] text-pearl-white">
                  {row.label}
                </h3>
                {row.note && (
                  <p className="text-right text-xs uppercase tracking-[0.18em] text-pearl-white/40">
                    {row.note}
                  </p>
                )}
              </div>
              <div
                className={
                  row.sponsors.length === 1
                    ? "flex justify-center"
                    : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:max-lg:[&>*:last-child:nth-child(odd)]:col-span-2 sm:max-lg:[&>*:last-child:nth-child(odd)]:mx-auto sm:max-lg:[&>*:last-child:nth-child(odd)]:w-[calc(50%-0.5rem)]"
                }
              >
                {row.sponsors.map((s) => (
                    <div
                      key={s.name}
                      className={
                        row.sponsors.length === 1
                          ? "w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
                          : "h-full"
                      }
                    >
                      <SponsorCard sponsor={s} />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SponsorsSection;
