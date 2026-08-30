"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Download, Trophy, ChevronDown } from "lucide-react";
import { useParallax, useMousePosition } from "@/hooks/use-animations";
import { events } from "@/lib/pravrutti-data";

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
          ? "none"
          : "0 0 7px #D64D8D, 0 0 20px rgba(214,77,141,0.5), 0 0 40px rgba(214,77,141,0.2)",
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

  const fullTagline = "3 DAYS · 24 ARENAS · ONE NATIONAL STAGE";

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
      setTypedText(fullTagline.slice(0, i));
      if (i >= fullTagline.length) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [isLoaded]);

  const tiltX = (mouse.y - 0.5) * -8;
  const tiltY = (mouse.x - 0.5) * 8;

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black select-none">

      {/* ===== BG 0: Full-screen gate temple image ===== */}
      <div className="absolute inset-0 z-0">
        <img
          src="/gate-temple.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
          style={{
            opacity: 0.7,
            transform: `scale(1.08) translateY(${-parallaxOffset * 0.08}px)`,
            transition: "transform 0.4s ease-out",
            filter: "saturate(1.1) brightness(0.65)",
          }}
        />
        {/* Lifts the halo disc behind the temple. Ring-shaped, not a plain
            radial: the disc centre is where the temple sits, so a filled
            gradient would wash out the stonework instead of the glow.
            Centre and radius measured off the artwork (50.5% / 46.5%). */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50.5% 46.5%, transparent 14%, rgba(190,64,92,0.30) 27%, rgba(170,58,88,0.14) 38%, transparent 52%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
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
          className="retro-grid"
          style={{ transform: `perspective(500px) rotateX(65deg) translateY(${parallaxOffset * 0.15}px)` }}
        />
      </div>

      {/* ===== BG 2: CRT scanlines ===== */}
      <div className="absolute inset-0 z-[4] pointer-events-none crt-scanlines" style={{ opacity: 0.08 }} />

      {/* ===== BG 6: Ambient center glow ===== */}
      <div
        className="absolute z-[5] pointer-events-none rounded-full"
        style={{
          width: "900px",
          height: "700px",
          left: "50%",
          top: "40%",
          transform: `translate(-50%, -50%)`,
          background: "radial-gradient(ellipse, rgba(214,77,141,0.1) 0%, rgba(114,31,76,0.04) 40%, transparent 70%)",
        }}
      />

      {/* ===== Left HUD ===== */}
      <div className="hidden xl:flex flex-col gap-4 absolute left-8 top-[22%] z-10 w-60 font-mono text-[11px] text-[#D64D8D]/70 text-left border-l border-[#D64D8D]/20 pl-4 py-3">
        <div className="text-[#F2D2AE]/80 font-bold tracking-[0.25em] text-[10px]">// SYSTEM_INITIALIZE</div>
        <div className="h-px bg-gradient-to-r from-[#D64D8D]/40 to-transparent w-20" />
        <div className="space-y-1.5">
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>CORE_LOAD: <span className="text-[#F2D2AE]/80">SUCCESS</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>PORTAL_GATE: <span className="text-green-400">OPEN</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>ARENAS_ACTIVE: <span className="text-[#F2D2AE]/80">24</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>MODE: <span className="text-[#D64D8D]">RETRO_ARCADE</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span className="animate-pulse text-[#F2D2AE]/60">AWAITING_REGISTRATION...</span></div>
        </div>
        <div className="text-[10px] text-white/35 mt-3 space-y-1 font-mono">
          <div>LOC: 13.0294° N, 77.5401° E</div>
          <div>NET: PRAVRUTTI_SECURE_NODE</div>
          <div>EST_ATTENDANCE: 5000+</div>
        </div>
      </div>

      {/* ===== Right HUD ===== */}
      <div className="hidden xl:flex flex-col gap-4 absolute right-8 top-[22%] z-10 w-60 font-mono text-[11px] text-[#D64D8D]/70 text-right border-r border-[#D64D8D]/20 pr-4 py-3">
        <div className="text-[#F2D2AE]/80 font-bold tracking-[0.25em] text-[10px]">// REGISTRATION_DESK</div>
        <div className="h-px bg-gradient-to-l from-[#D64D8D]/40 to-transparent w-20 ml-auto" />
        <div className="space-y-1.5">
          <div>STATUS: <span className="text-green-400">LIVE</span></div>
          <div>PRIZE_POOL: <span className="text-[#F2D2AE]/90">₹8,00,000+</span></div>
          <div>EVENTS_ARENA: <span className="text-[#D64D8D]">OFFLINE</span></div>
          <div>HOST_NEXUS: <span className="text-[#F2D2AE]/70">RAMAIAH_TECHNOLOGY_CAMPUS</span></div>
        </div>
        {/* Mini bar graph */}
        <div className="flex items-end gap-1 justify-end mt-2 h-6">
          {[40, 65, 30, 80, 55, 90, 45, 70, 60, 85].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-[#D64D8D]/30 rounded-t-sm"
              style={{
                height: `${h}%`,
                animation: `bar-pulse ${1.5 + i * 0.2}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      {/* Legibility scrim — guarantees the copy has clean ground to sit on no
          matter how busy the temple photograph is behind it. */}
      <div
        className="absolute z-[7] pointer-events-none inset-0"
        style={{
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
            className="absolute -inset-20 pointer-events-none rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(214,77,141,0.08) 0%, transparent 60%)",
              filter: "blur(40px)",
              animation: "logo-breathe 4s ease-in-out infinite",
            }}
          />

          <img
            src="/pravrutti-logo.png"
            alt="Pravrutti 2.0"
            className="relative w-[320px] sm:w-[440px] md:w-[560px] lg:w-[680px] h-auto object-contain select-none"
            width={1600}
            height={800}
            draggable={false}
            style={{
              transform: mouse.active
                ? `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${-parallaxOffset * 0.06}px)`
                : `translateY(${-parallaxOffset * 0.06}px)`,
              transition: mouse.active ? "transform 0.12s ease-out" : "transform 0.5s ease-out",
              filter: "drop-shadow(0 0 30px rgba(214,77,141,0.25)) drop-shadow(0 0 60px rgba(114,31,76,0.12))",
            }}
          />
        </h1>

        {/* ── Typewriter strapline.
               The logo lockup already carries "CODE. CREATE. INNOVATE. ELEVATE."
               and "NATIONAL TECH FEST", so echoing either here just stacked the
               same words three times. This line adds the thing the artwork can't:
               where it is and who it's open to. ── */}
        <div
          className={`mb-6 h-8 md:h-10 flex items-center transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "0.6s" }}
        >
          <p className="font-orbitron text-sm sm:text-base md:text-xl font-black tracking-[0.12em] text-[#F2D2AE] inline-block">
            <NeonFlickerText text={typedText} />
            <span
              className="inline-block w-[2px] h-[1em] bg-[#D64D8D] ml-1 align-middle"
              style={{ animation: "blink-caret 0.6s step-end infinite" }}
            />
          </p>
        </div>

        {/* ── Description ── */}
        <p
          className={`max-w-xl text-sm md:text-base text-[#F7EEE4]/75 leading-relaxed font-mono mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
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
          <span className="inline-flex items-center gap-2 font-mono text-xs md:text-sm tracking-[0.12em] text-[#F7EEE4]/85 border border-[#4A1C3A]/60 bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full">
            <Calendar className="w-4 h-4 text-[#D64D8D]" />
            14th, 15th &amp; 16th October 2026
          </span>
        </div>

        {/* ── PRIZE POOL — the headline attraction ── */}
        <div
          className={`w-full max-w-3xl mb-7 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"}`}
          style={{ transitionDelay: "1.4s" }}
        >
          <div className="relative rounded-2xl border-2 border-[#BF8A1B]/45 bg-gradient-to-b from-[#2B122C]/80 via-[#150B1E]/85 to-black/85 backdrop-blur-md px-5 py-6 sm:px-9 sm:py-7 overflow-hidden">
            {/* Warm glow behind the number */}
            <div
              className="absolute inset-x-0 top-0 h-full pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 30% 40%, rgba(242,210,174,0.16) 0%, transparent 62%)",
              }}
            />
            <div className="absolute inset-0 crt-scanlines opacity-[0.07] pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-center sm:items-stretch justify-center gap-6 sm:gap-9">
              {/* Prize pool — dominant */}
              <div className="text-center sm:text-left min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-[#F2D2AE]" />
                  <span className="font-mono text-[11px] md:text-sm tracking-[0.28em] uppercase text-[#F2D2AE]">
                    Total Prize Pool
                  </span>
                </div>
                <div
                  className="font-orbitron font-black leading-none text-[2.5rem] sm:text-5xl md:text-6xl tracking-tight whitespace-nowrap"
                  style={{
                    background: "linear-gradient(180deg, #FFF3E0 0%, #F2D2AE 45%, #BF8A1B 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    filter: "drop-shadow(0 0 22px rgba(242,210,174,0.35))",
                  }}
                >
                  ₹8,00,000+
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-[2px] self-stretch rounded-full bg-gradient-to-b from-transparent via-[#BF8A1B]/70 to-transparent" />
              <div className="sm:hidden h-[2px] w-4/5 rounded-full bg-gradient-to-r from-transparent via-[#BF8A1B]/70 to-transparent" />

              {/* Event count — secondary, but panelled so it reads as its own
                  stat instead of floating against the band's edge. */}
              <div className="shrink-0 flex flex-col items-center justify-center text-center rounded-xl border border-[#D64D8D]/30 bg-[#D64D8D]/[0.07] px-5 py-3">
                {/* Derived, so it can never drift from the data again. */}
                <div className="font-orbitron font-black leading-none text-4xl sm:text-5xl text-[#D64D8D] drop-shadow-[0_0_18px_rgba(214,77,141,0.45)]">
                  {events.length}
                </div>
                <span className="font-mono text-[11px] md:text-xs tracking-[0.22em] uppercase text-[#F7EEE4]/85 mt-2 whitespace-nowrap">
                  Tech Events
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA Buttons ── */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.5s" }}
        >
          <Link href="/events">
            <Button
              size="lg"
              className="arcade-btn-primary rounded-lg font-orbitron text-xs md:text-sm px-7 md:px-9 py-5 h-auto font-black tracking-[0.12em] cursor-pointer"
            >
              EXPLORE EVENTS <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <a href="/Pravrutti_Main_Brochure.pdf" download>
            <Button
              size="lg"
              className="arcade-btn rounded-lg font-orbitron text-xs md:text-sm px-7 md:px-9 py-5 h-auto font-black tracking-[0.12em] text-[#F2D2AE] cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" /> BROCHURE
            </Button>
          </a>
        </div>

        {/* The stats bar (5000+ Participants / 3 Days / 20+ Clubs) is gone:
            '3 Days' already leads the tagline, and the other two are figures
            nobody deciding whether to register needs in the first screen. */}

        {/* ── Scroll cue.
               Kept in the flow rather than absolutely positioned at the bottom of
               the section: at bottom-6 it sat inside the content's own padding and
               collided with the stats row above it. ── */}
        <div
          className={`mt-10 flex flex-col items-center gap-2 transition-all duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "2.2s" }}
        >
          <span
            className="font-arcade text-[9px] md:text-[11px] tracking-[0.25em] uppercase text-[#D64D8D]/80"
            style={{ animation: "arcade-blink 1.6s step-end infinite" }}
          >
            Scroll to explore
          </span>
          <ChevronDown className="w-4 h-4 text-[#D64D8D]/70 animate-bounce" />
        </div>
      </div>

    </section>
  );
}
