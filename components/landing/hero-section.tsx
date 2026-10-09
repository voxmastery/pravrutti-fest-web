"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Trophy, ChevronDown, Clock } from "lucide-react";
import { useParallax, useMousePosition } from "@/hooks/use-animations";
import {
  CAMPUS_COORDS,
  events,
  FEST,
  formatINR,
  REGISTRATION_CLOSES_DISPLAY,
  REGISTRATION_CLOSES_LONG,
  effectiveRegistrationState,
  ANNOUNCED_PRIZE_POOL,
} from "@/lib/pravrutti-data";
import { FEE_PER_HEAD } from "@/lib/applications";
import { PALETTE } from "@/lib/palette";
import { PrizeGstNote } from "@/components/prize-gst-note";

/* The HUD panels speak in terminal case, but every value is derived from the
   fest data rather than retyped: the old panels carried a literal arena count
   and hand-typed dates, which are right only until the data moves. */
const HUD_DATES = FEST.dates.toUpperCase().replace(/([A-Z]{3})[A-Z]+/, "$1");
const HUD_VENUE = FEST.venue.split(",")[0].trim().toUpperCase().replace(/\s+/g, "_");
/* Same figure as the "Tech Events" badge, which prints events.length. A
   literal here is how the strapline stayed on 24 after a 25th arena landed. */
const HERO_TAGLINE = `3 DAYS · ${events.length} ARENAS · ONE NATIONAL STAGE`;

/* ───────────────────── Neon Flicker Text ───────────────────── */
function NeonFlickerText({ text, className = "" }: { text: string; className?: string }) {
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    const doFlicker = () => {
      setFlicker(true);
      setTimeout(() => setFlicker(false), 100 + Math.random() * 150);
    };
    const id = setInterval(doFlicker, 3000 + Math.random() * 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className={className}
      style={{
        opacity: flicker ? 0.3 : 1,
        transition: "opacity 0.05s",
        textShadow: flicker
          ? "none" : `0 0 7px ${PALETTE.cyberPink}, 0 0 20px ${PALETTE.cyberPink}80, 0 0 40px ${PALETTE.cyberPink}33`,
      }}
    >
      {text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION — Full Immersive Retro Arcade Portal
   ═══════════════════════════════════════════════════════════════ */
export function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [typedText, setTypedText] = useState("");
  const logoRef = useRef<HTMLHeadingElement>(null);
  const parallaxOffset = useParallax(0.15);
  const mouse = useMousePosition(logoRef);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Typewriter for tagline
  useEffect(() => {
    if (!isLoaded) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTypedText(HERO_TAGLINE.slice(0, i));
      if (i >= HERO_TAGLINE.length) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [isLoaded]);

  const tiltX = (mouse.y - 0.5) * -8;
  const tiltY = (mouse.x - 0.5) * 8;

  const regState = effectiveRegistrationState();
  const isRegistrationOpen = regState === "open";

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black select-none">

      {/* ===== BG 0: Full-screen gate temple image ===== */}
      <div className="absolute inset-0 z-0">
        <img
          /* .webp, not the .png original: Hostinger's CDN re-encodes PNG and
             JPEG at its own quality and returned this hero at 20 KB on mobile,
             which flattened the temple into unreadable mush. Files that are
             already .webp are served byte-for-byte untouched. */
          src="/gate-temple.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center select-none" style={{
            /* The artwork carries the page; it is dimmed just enough for the
               headline to sit on it. Every layer below is a shaping gradient,
               not a second dimmer — stacking dimmers crushed the gate to a
               silhouette. */
            opacity: 0.92,
            /* No transition here on purpose. The transform is rewritten on
               every scroll frame, so a 0.4s ease would restart continuously and
               the image would permanently chase the scroll — which reads as the
               whole screen twitching. requestAnimationFrame in useParallax is
               already the smoothing. */
            transform: `scale(1.08) translateY(${-parallaxOffset * 0.08}px)`,
            willChange: "transform",
            filter: "saturate(1.15) brightness(0.88)",
          }}
        />
        {/* Lifts the halo disc behind the temple. Ring-shaped, not a plain
            radial: the disc centre is where the temple sits, so a filled
            gradient would wash out the stonework instead of the glow.
            Centre and radius measured off the artwork (50.5% / 46.5%). */}
        <div
          className="absolute inset-0 pointer-events-none" style={{
            background:
              "radial-gradient(circle at 50.5% 46.5%, transparent 14%, rgba(190,64,92,0.30) 27%, rgba(170,58,88,0.14) 38%, transparent 52%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Gradient overlays for depth */}
        {/* Top: keeps the nav legible. Bottom: blends into the next section. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15" />
        {/* Vignette */}
        <div
          className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>

      {/* Background layers, cut from six to two.
          Gone: the matrix-rain canvas (a 1M-pixel repaint every 50ms, forever),
          the five pulsing rings and the sweeping scanline. Together they ran 16
          simultaneous animations behind the one screen that has to say what this
          is and where to register — so nothing read as emphasis because nothing
          was ever still. The grid and CRT texture stay: both are static. */}

      {/* ===== BG 1: Retro perspective grid ===== */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <div
          className="retro-grid" style={{ transform: `perspective(500px) rotateX(65deg) translateY(${parallaxOffset * 0.15}px)`, willChange: "transform" }}
        />
      </div>

      {/* ===== BG 2: CRT scanlines ===== */}
      <div className="absolute inset-0 z-[4] pointer-events-none crt-scanlines" style={{ opacity: 0.08 }} />

      {/* ===== BG 6: Ambient center glow ===== */}
      <div
        className="absolute z-[5] pointer-events-none rounded-full" style={{
          width: "900px",
          height: "700px",
          left: "50%",
          top: "40%",
          transform: `translate(-50%, -50%)`,
          background: "radial-gradient(ellipse, rgba(214,77,141,0.1) 0%, rgba(114,31,76,0.04) 40%, transparent 70%)",
        }}
      />

      {/* ===== Left HUD — the fest's four hard facts.
             Was "SYSTEM_INITIALIZE": a boot log for a system that doesn't exist,
             plus an attendance estimate nobody can verify. Every line here is now
             something a visitor can act on, read straight off the data. ===== */}
      <div className="hidden xl:flex flex-col gap-4 absolute left-8 top-[22%] z-10 w-60 text-[11px] text-cyber-pink/70 text-left border-l border-cyber-pink/20 pl-4 py-3">
        <div className="text-champagne-gold/80 font-bold tracking-[0.25em] text-[10px]">// FEST_BRIEFING</div>
        <div className="h-px bg-gradient-to-r from-cyber-pink/40 to-transparent w-20" />
        <div className="space-y-1.5">
          <div className="flex gap-2"><span className="text-cyber-pink">&gt;</span> <span>DATES: <span className="text-champagne-gold/80">{HUD_DATES}</span></span></div>
          <div className="flex gap-2"><span className="text-cyber-pink">&gt;</span> <span>ARENAS: <span className="text-champagne-gold/80">{events.length}</span></span></div>
          <div className="flex gap-2"><span className="text-cyber-pink">&gt;</span> <span>VENUE: <span className="text-champagne-gold/70">{HUD_VENUE}</span></span></div>
          {/* Dropped rather than guessed if the map embed stops yielding a fix. */}
          {CAMPUS_COORDS && (
            <div className="flex gap-2"><span className="text-cyber-pink">&gt;</span> <span>LOC: <span className="text-white/45">{CAMPUS_COORDS.label}</span></span></div>
          )}
        </div>
      </div>

      {/* ===== Right HUD — the registration desk.
             The old "STATUS: LIVE" was a literal, so the hero would have gone on
             claiming registration was open after it shut. ===== */}
      <div className="hidden xl:flex flex-col gap-4 absolute right-8 top-[22%] z-10 w-60 text-[11px] text-cyber-pink/70 text-right border-r border-cyber-pink/20 pr-4 py-3">
        <div className="text-champagne-gold/80 font-bold tracking-[0.25em] text-[10px]">// REGISTRATION_DESK</div>
        <div className="h-px bg-gradient-to-l from-cyber-pink/40 to-transparent w-20 ml-auto" />
        <div className="space-y-1.5">
          <div>
            REGISTRATION:{" "}
            {regState === "open"
              ? <span className="text-success motion-safe:animate-pulse">OPEN</span>
              : regState === "upcoming"
                ? <span className="text-champagne-gold">OPENING SOON</span>
                : <span className="text-cyber-pink">CLOSED</span>}
          </div>
          {/* A deadline that has already passed is noise, so it goes with it —
              and with none announced there is no row to show at all. */}
          {isRegistrationOpen && REGISTRATION_CLOSES_DISPLAY && (
            <div>CLOSES: <span className="text-champagne-gold/70">{REGISTRATION_CLOSES_DISPLAY}</span></div>
          )}
          <div>ENTRY: <span className="text-champagne-gold/70">₹{FEE_PER_HEAD}/TEAM</span></div>
          <div>PRIZE_POOL: <span className="text-champagne-gold/90">{formatINR(ANNOUNCED_PRIZE_POOL)}</span></div>
          <PrizeGstNote className="text-right text-[9px]" />
        </div>
      </div>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      {/* Legibility scrim — guarantees the copy has clean ground to sit on no
          matter how busy the temple photograph is behind it. */}
      <div
        className="absolute z-[7] pointer-events-none inset-0" style={{
          background:
            "radial-gradient(ellipse 58% 62% at 50% 50%, rgba(5,3,9,0.78) 0%, rgba(5,3,9,0.55) 45%, transparent 78%)",
        }}
      />

      {/* pt clears the transparent header, which is 96px tall (h-24). Sized so the
          wordmark sits ~36px below the nav marks: enough to breathe, without the
          dead band the original pt-28 left. */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-6 pt-[108px] pb-12 flex flex-col items-center text-center">

        {/* ── THE LOGO — this is the page's real h1; the wordmark lives in the
               artwork, so the accessible/SEO heading rides along as sr-only text ── */}
        <h1
          ref={logoRef}
          className={`relative mb-3 cursor-default transition-all duration-[2s] ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
          style={{ transitionDelay: "0.3s" }}
        >
          <span className="sr-only">Pravrutti 2.0 — National Tech Fest, Ramaiah University of Applied Sciences</span>
          {/* Pulsing glow behind logo */}
          <div
            className="absolute -inset-20 pointer-events-none rounded-full" style={{
              background: "radial-gradient(ellipse at center, rgba(214,77,141,0.08) 0%, transparent 60%)",
              filter: "blur(40px)",
              animation: "logo-breathe 4s ease-in-out infinite",
            }}
          />

          <img
            src="/pravrutti-logo.webp" alt="Pravrutti 2.0" className="relative w-[320px] sm:w-[440px] md:w-[560px] lg:w-[680px] h-auto object-contain select-none" width={1600}
            height={800}
            draggable={false}
            style={{
              transform: mouse.active
                ? `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${-parallaxOffset * 0.06}px)` : `translateY(${-parallaxOffset * 0.06}px)`,
              transition: mouse.active ? "transform 0.12s ease-out" : "transform 0.5s ease-out",
              filter: "drop-shadow(0 0 30px rgba(214,77,141,0.25)) drop-shadow(0 0 60px rgba(114,31,76,0.12))",
            }}
          />
        </h1>

        {/* ── Typewriter strapline.
               The logo lockup already carries "CODE. CREATE. INNOVATE. ELEVATE." and "NATIONAL TECH FEST", so echoing either here just stacked the
               same words three times. This line adds the thing the artwork can't:
               where it is and who it's open to. ── */}
        <div
          className={`mb-6 h-8 md:h-10 flex items-center transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "0.6s" }}
        >
          <p className="font-display text-sm sm:text-base md:text-xl font-black tracking-[0.12em] text-champagne-gold inline-block">
            <NeonFlickerText text={typedText} />
            <span
              className="inline-block w-[2px] h-[1em] bg-cyber-pink ml-1 align-middle" style={{ animation: "blink-caret 0.6s step-end infinite" }}
            />
          </p>
        </div>

        {/* ── Description ── */}
        <p
          className={`max-w-xl text-sm md:text-base text-pearl-white/75 leading-relaxed mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1s" }}
        >
          Step through the gate into the Ramaiah Technology Campus, Bengaluru — open to
          students from across the country.
        </p>

        {/* Countdown removed — the date pill below already says when. */}

        {/* ── Date ── */}
        <div
          className={`mb-5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.3s" }}
        >
          <span className="inline-flex items-center gap-2 text-xs md:text-sm tracking-[0.12em] text-pearl-white/85 border border-royal-wine/60 bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full">
            <Calendar className="w-4 h-4 text-cyber-pink" />
            14th, 15th &amp; 16th October 2026
          </span>
        </div>

        {/* ── PRIZE POOL — compact chip on phone/tablet so the gate photo
               shows through; xl+ keeps the billboard the side rails make room for. ── */}
        <div
          className={`w-auto max-w-full mb-3 xl:w-full xl:max-w-3xl xl:mb-7 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"}`}
          style={{ transitionDelay: "1.4s" }}
        >
          <div className="relative rounded-lg xl:rounded-2xl border border-soft-gold/35 xl:border-2 xl:border-soft-gold/45 bg-cosmic-purple/30 xl:bg-gradient-to-b xl:from-deep-plum/80 xl:via-cosmic-purple/85 xl:to-black/85 backdrop-blur-none xl:backdrop-blur-md px-2.5 py-1.5 xl:px-9 xl:py-7 overflow-hidden">
            {/* Warm glow behind the number — desktop only; on phone it frosts the gate */}
            <div
              className="absolute inset-x-0 top-0 h-full pointer-events-none hidden xl:block" style={{
                background: "radial-gradient(ellipse at 30% 40%, rgba(242,210,174,0.16) 0%, transparent 62%)",
              }}
            />
            <div className="absolute inset-0 crt-scanlines opacity-[0.07] pointer-events-none hidden xl:block" />
            <div className="relative flex flex-col items-center">
            <div className="flex flex-row items-center justify-center gap-2.5 xl:gap-9">
              {/* Prize pool — dominant */}
              <div className="text-left min-w-0">
                <div className="flex items-center justify-start gap-1 xl:gap-2 mb-0 xl:mb-1.5">
                  <Trophy className="w-3 h-3 xl:w-5 xl:h-5 text-champagne-gold" />
                  <span className="text-[9px] xl:text-sm tracking-[0.18em] xl:tracking-[0.28em] uppercase text-champagne-gold">
                    Total Prize Pool
                  </span>
                </div>
                <div
                  className="font-display font-black leading-none text-lg xl:text-6xl tracking-tight whitespace-nowrap drop-shadow-[0_0_6px_rgba(242,210,174,0.2)] xl:drop-shadow-[0_0_22px_rgba(242,210,174,0.35)] text-gold-gradient"
                >
                  {formatINR(ANNOUNCED_PRIZE_POOL)}
                </div>
              </div>

              {/* Divider — always vertical; the chip stays a single row */}
              <div className="w-px xl:w-[2px] self-stretch min-h-[2rem] xl:min-h-0 rounded-full bg-gradient-to-b from-transparent via-soft-gold/70 to-transparent" />

              {/* Event count — secondary, but panelled so it reads as its own
                  stat instead of floating against the band's edge. */}
              <div className="shrink-0 flex flex-col items-center justify-center text-center rounded xl:rounded-xl border border-cyber-pink/30 bg-cyber-pink/[0.06] px-2 py-0.5 xl:px-5 xl:py-3">
                {/* Derived, so it can never drift from the data again. */}
                <div className="font-display font-black leading-none text-sm xl:text-5xl text-cyber-pink drop-shadow-[0_0_6px_rgba(214,77,141,0.35)] xl:drop-shadow-[0_0_18px_rgba(214,77,141,0.45)]">
                  {events.length}
                </div>
                <span className="text-[8px] xl:text-xs tracking-[0.14em] xl:tracking-[0.22em] uppercase text-pearl-white/85 mt-0 xl:mt-2 whitespace-nowrap">
                  Tech Events
                </span>
              </div>
            </div>
            <PrizeGstNote className="mt-1 whitespace-nowrap text-center text-[9px] xl:mt-2 xl:text-[11px]" />
            </div>
          </div>
        </div>

        {/* ── Deadline, right under the prize: the organisers want it seen
               before anything else on the first screen. ── */}
        {isRegistrationOpen && REGISTRATION_CLOSES_LONG && (
          <div
            className={`mb-4 xl:mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            style={{ transitionDelay: "1.45s" }}
          >
            <p className="inline-flex items-center justify-center text-center gap-2 xl:gap-3 whitespace-nowrap max-[379px]:whitespace-normal max-[379px]:rounded-2xl max-[379px]:max-w-[17rem] rounded-full border border-cyber-pink/50 bg-cyber-pink/15 px-3.5 py-2.5 xl:px-6 xl:py-3 font-display font-black uppercase tracking-[0.04em] xl:tracking-[0.08em] text-[13px] sm:text-base xl:text-2xl text-champagne-gold shadow-[0_0_18px_rgba(214,77,141,0.35)]">
              <Clock className="w-4 h-4 xl:w-6 xl:h-6 shrink-0 text-cyber-pink" aria-hidden="true" />
              Registrations close {REGISTRATION_CLOSES_LONG}
            </p>
          </div>
        )}

        {/* ── CTA Buttons ── */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.5s" }}
        >
          <Button
            asChild
            size="lg" className="arcade-btn-primary rounded-lg font-display text-xs md:text-sm px-7 md:px-9 py-5 h-auto font-black tracking-[0.12em] cursor-pointer" >
            <Link href="/events">
              EXPLORE EVENTS <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* The stats bar (5000+ Participants / 3 Days / 20+ Clubs) is gone:
            '3 Days' already leads the tagline, and the other two are figures
            nobody deciding whether to register needs in the first screen. */}

        {/* ── Registration facts, for the phones the side rails never reach.
               Sits BELOW the CTAs on purpose: at 375×667 the buttons are already
               at the edge of the first screen, so anything inserted above them
               would push the primary action off it. Everything above the CTAs is
               untouched, so this cannot move them.
               Carries only what mobile is otherwise missing — the dates are in
               the pill above and the prize pool and arena count are in the card,
               so repeating either would cost height and say nothing new. ── */}
        <div
          className={`xl:hidden mt-5 transition-all duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "1.6s" }}
        >
          <dl className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-cyber-pink/25 bg-black/60 backdrop-blur-sm px-4 py-2.5">
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-pearl-white/55">Registration</dt>
              <dd className="flex items-center gap-1.5 text-sm font-semibold">
                {regState === "open" ? (
                  <>
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse" />
                    <span className="text-success-soft">Open</span>
                  </>
                ) : regState === "upcoming" ? (
                  <span className="text-champagne-gold">Opening soon</span>
                ) : (
                  <span className="text-cyber-pink">Closed</span>
                )}
              </dd>
            </div>
            {isRegistrationOpen && REGISTRATION_CLOSES_DISPLAY && (
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-pearl-white/55">Closes</dt>
                <dd className="text-sm font-semibold text-champagne-gold">{REGISTRATION_CLOSES_DISPLAY}</dd>
              </div>
            )}
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-pearl-white/55">Entry</dt>
              <dd className="text-sm font-semibold text-champagne-gold">₹{FEE_PER_HEAD}<span className="text-pearl-white/55 font-normal">/team</span></dd>
            </div>
          </dl>
        </div>

        {/* ── Scroll cue.
               Kept in the flow rather than absolutely positioned at the bottom of
               the section: at bottom-6 it sat inside the content's own padding and
               collided with the stats row above it. ── */}
        <div
          className={`mt-10 flex flex-col items-center gap-2 transition-all duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "2.2s" }}
        >
          <span
            className="text-[9px] md:text-[11px] tracking-[0.25em] uppercase text-cyber-pink/80" style={{ animation: "arcade-blink 1.6s step-end infinite" }}
          >
            Scroll to explore
          </span>
          <ChevronDown className="w-4 h-4 text-cyber-pink/70 animate-bounce" />
        </div>
      </div>

    </section>
  );
}
