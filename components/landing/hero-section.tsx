"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Timer, Download, Zap } from "lucide-react";
import { useParallax, useMousePosition } from "@/hooks/use-animations";

/* ───────────────────── Matrix Rain Column ───────────────────── */
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const cols = Math.floor(w / 18);
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -100);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = "14px monospace";

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 18;
        const y = drops[i] * 18;

        // Gradient: head is bright pink, tail fades to dark purple
        const brightness = Math.random();
        if (brightness > 0.95) {
          ctx.fillStyle = "#F2D2AE"; // gold flash
        } else if (brightness > 0.8) {
          ctx.fillStyle = "#D64D8D"; // cyber pink
        } else {
          ctx.fillStyle = "rgba(114,31,76,0.4)"; // dark purple
        }

        ctx.fillText(char, x, y);

        if (y > h && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const id = setInterval(draw, 50);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[1] pointer-events-none"
      style={{ opacity: 0.35, mixBlendMode: "screen" }}
    />
  );
}

/* ───────────────────── Energy Pulse Rings ───────────────────── */
function EnergyPulseRings() {
  return (
    <div className="absolute inset-0 z-[3] pointer-events-none flex items-center justify-center">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${300 + i * 120}px`,
            height: `${300 + i * 120}px`,
            borderColor: i % 2 === 0 ? "rgba(214,77,141,0.12)" : "rgba(242,210,174,0.06)",
            animation: `energy-pulse ${4 + i * 0.8}s ease-in-out infinite`,
            animationDelay: `${i * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}

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

/* ───────────────────── Scanline Horizontal Sweep ───────────────────── */
function ScanlineSweep() {
  return (
    <div
      className="absolute inset-0 z-[6] pointer-events-none overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    >
      <div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(214,77,141,0.4), rgba(242,210,174,0.3), rgba(214,77,141,0.4), transparent)",
          animation: "scanline-sweep 6s linear infinite",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION — Full Immersive Retro Arcade Portal
   ═══════════════════════════════════════════════════════════════ */
export function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [typedText, setTypedText] = useState("");
  const logoRef = useRef<HTMLDivElement>(null);
  const parallaxOffset = useParallax(0.15);
  const mouse = useMousePosition(logoRef);

  const fullTagline = "CODE. CREATE. INNOVATE. ELEVATE.";

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

  // Countdown
  useEffect(() => {
    const target = new Date("2026-10-15T09:00:00").getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

      {/* ===== BG 1: Matrix rain ===== */}
      <MatrixRain />

      {/* ===== BG 2: Retro perspective grid ===== */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <div
          className="retro-grid"
          style={{ transform: `perspective(500px) rotateX(65deg) translateY(${parallaxOffset * 0.15}px)` }}
        />
      </div>

      {/* ===== BG 3: Energy pulse rings ===== */}
      <EnergyPulseRings />

      {/* ===== BG 4: CRT scanlines ===== */}
      <div className="absolute inset-0 z-[4] pointer-events-none crt-scanlines" style={{ opacity: 0.08 }} />

      {/* ===== BG 5: Horizontal scanline sweep ===== */}
      <ScanlineSweep />

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
      <div className="hidden xl:flex flex-col gap-4 absolute left-8 top-[22%] z-10 w-56 font-mono text-[9px] text-[#D64D8D]/50 text-left border-l border-[#D64D8D]/20 pl-4 py-3">
        <div className="text-[#F2D2AE]/70 font-bold tracking-[0.25em] text-[8px]">// SYSTEM_INITIALIZE</div>
        <div className="h-px bg-gradient-to-r from-[#D64D8D]/40 to-transparent w-20" />
        <div className="space-y-1.5">
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>CORE_LOAD: <span className="text-[#F2D2AE]/80">SUCCESS</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>PORTAL_GATE: <span className="text-green-400">OPEN</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>ARENAS_ACTIVE: <span className="text-[#F2D2AE]/80">25+</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span>MODE: <span className="text-[#D64D8D]">RETRO_ARCADE</span></span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]">&gt;</span> <span className="animate-pulse text-[#F2D2AE]/60">AWAITING_REGISTRATION...</span></div>
        </div>
        <div className="text-[7px] text-white/20 mt-3 space-y-0.5 font-mono">
          <div>LOC: 13.0294° N, 77.5401° E</div>
          <div>NET: PRAVRUTTI_SECURE_NODE</div>
          <div>EST_ATTENDANCE: 5000+</div>
        </div>
      </div>

      {/* ===== Right HUD ===== */}
      <div className="hidden xl:flex flex-col gap-4 absolute right-8 top-[22%] z-10 w-56 font-mono text-[9px] text-[#D64D8D]/50 text-right border-r border-[#D64D8D]/20 pr-4 py-3">
        <div className="text-[#F2D2AE]/70 font-bold tracking-[0.25em] text-[8px]">// REGISTRATION_DESK</div>
        <div className="h-px bg-gradient-to-l from-[#D64D8D]/40 to-transparent w-20 ml-auto" />
        <div className="space-y-1.5">
          <div>STATUS: <span className="text-green-400">LIVE</span></div>
          <div>PRIZE_POOL: <span className="text-[#F2D2AE]/90">₹2,00,000+</span></div>
          <div>EVENTS_ARENA: <span className="text-[#D64D8D]">ONLINE</span></div>
          <div>HOST_NEXUS: <span className="text-[#F2D2AE]/70">PEENYA_CAMPUS</span></div>
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
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-16 pb-10 flex flex-col items-center text-center">

        {/* "INSERT COIN" arcade prompt */}
        <div
          className={`mb-4 transition-all duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D64D8D]/30 bg-[#150B1E]/40 backdrop-blur-md">
            <Zap className="w-3 h-3 text-[#D64D8D] animate-pulse" />
            <span className="font-mono text-[8px] tracking-[0.4em] uppercase text-[#D64D8D]/80">
              Ramaiah University of Applied Sciences
            </span>
            <Zap className="w-3 h-3 text-[#D64D8D] animate-pulse" />
          </div>
        </div>

        {/* ── THE LOGO ── */}
        <div
          ref={logoRef}
          className={`relative mb-2 cursor-default transition-all duration-[2s] ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
          style={{ transitionDelay: "0.3s" }}
        >
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
            className="relative w-[300px] md:w-[420px] lg:w-[520px] h-auto object-contain select-none"
            draggable={false}
            style={{
              transform: mouse.active
                ? `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${-parallaxOffset * 0.06}px)`
                : `translateY(${-parallaxOffset * 0.06}px)`,
              transition: mouse.active ? "transform 0.12s ease-out" : "transform 0.5s ease-out",
              filter: "drop-shadow(0 0 30px rgba(214,77,141,0.25)) drop-shadow(0 0 60px rgba(114,31,76,0.12))",
            }}
          />
        </div>

        {/* ── Tagline with typewriter ── */}
        <div
          className={`mb-3 h-8 md:h-10 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "0.6s" }}
        >
          <h1 className="font-orbitron text-sm md:text-xl lg:text-2xl font-black tracking-[0.15em] text-[#F2D2AE] inline-block">
            <NeonFlickerText text={typedText} />
            <span className="inline-block w-[2px] h-[1em] bg-[#D64D8D] ml-1 align-middle" style={{ animation: "blink-caret 0.6s step-end infinite" }} />
          </h1>
        </div>

        {/* ── "EXPERIENCE INNOVATION" sub-tagline ── */}
        <div
          className={`mb-5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "0.9s" }}
        >
          <p className="font-mono text-[9px] md:text-[11px] tracking-[0.5em] uppercase text-[#D64D8D]/80">
            &lt; experience innovation /&gt;
          </p>
        </div>

        {/* ── Description ── */}
        <p
          className={`max-w-md text-[10px] md:text-xs text-[#F7EEE4]/60 leading-relaxed font-mono mb-5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1s" }}
        >
          Step through the gate into RUAS Peenya campus.
          <br className="hidden md:block" />
          25+ technical arenas &bull; ₹2,00,000+ prize pool &bull; 3 days.
        </p>

        {/* ── Countdown ── */}
        <div
          className={`mb-5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.1s" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Timer className="w-3 h-3 text-[#D64D8D]/70 animate-pulse" />
            <span className="font-mono text-[7px] tracking-[0.4em] uppercase text-[#D64D8D]/70">Portal Opens In</span>
          </div>
          <div className="flex gap-2 md:gap-3">
            {[
              { v: timeLeft.days, l: "DAYS" },
              { v: timeLeft.hours, l: "HRS" },
              { v: timeLeft.minutes, l: "MIN" },
              { v: timeLeft.seconds, l: "SEC" },
            ].map((t) => (
              <div key={t.l} className="flex flex-col items-center">
                <div className="relative w-12 md:w-14 h-12 md:h-14 flex items-center justify-center rounded border border-[#D64D8D]/20 bg-black/60 backdrop-blur-sm overflow-hidden group hover:border-[#D64D8D]/50 transition-all hover:shadow-[0_0_20px_rgba(214,77,141,0.2)]">
                  <div className="absolute inset-0 crt-scanlines opacity-10 pointer-events-none" />
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#D64D8D]/40" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#D64D8D]/40" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#D64D8D]/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#D64D8D]/40" />
                  <span className="relative font-vt323 text-xl md:text-2xl text-[#F2D2AE] tabular-nums group-hover:text-[#D64D8D] transition-colors">
                    {String(t.v).padStart(2, "0")}
                  </span>
                </div>
                <span className="font-mono text-[6px] tracking-[0.2em] text-[#F7EEE4]/40 mt-1 uppercase">{t.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Date ── */}
        <div
          className={`mb-5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.3s" }}
        >
          <span className="inline-flex items-center gap-2 font-mono text-[9px] md:text-[10px] tracking-[0.15em] text-[#F7EEE4]/60 border border-[#4A1C3A]/35 bg-black/30 backdrop-blur-sm px-3.5 py-1 rounded-full">
            <Calendar className="w-3 h-3 text-[#D64D8D]/60" />
            15th, 16th &amp; 17th October 2026
          </span>
        </div>

        {/* ── CTA Buttons ── */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.5s" }}
        >
          <Link href="/events">
            <Button
              size="lg"
              className="arcade-btn-primary rounded-lg font-orbitron text-[9px] md:text-[10px] px-7 md:px-9 py-4 h-auto font-black tracking-[0.15em] cursor-pointer"
            >
              EXPLORE EVENTS <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </Link>
          <a href="/Pravrutti_Main_Brochure.pdf" download>
            <Button
              size="lg"
              className="arcade-btn rounded-lg font-orbitron text-[9px] md:text-[10px] px-7 md:px-9 py-4 h-auto font-black tracking-[0.15em] text-[#F2D2AE] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-2" /> BROCHURE
            </Button>
          </a>
        </div>

        {/* ── Stats bar ── */}
        <div
          className={`mt-8 pt-5 border-t border-[#D64D8D]/10 w-full max-w-lg transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          style={{ transitionDelay: "1.8s" }}
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: "5000+", l: "Participants", c: "text-[#F2D2AE]" },
              { v: "25+", l: "Tech Events", c: "text-[#D64D8D]" },
              { v: "₹2L+", l: "Prize Pool", c: "text-[#BF8A1B]" },
            ].map((s) => (
              <div key={s.l} className="text-center group cursor-default">
                <div className={`text-lg md:text-2xl font-orbitron font-black ${s.c} group-hover:scale-110 transition-transform`}>
                  {s.v}
                </div>
                <div className="text-[7px] font-mono tracking-[0.2em] text-[#F7EEE4]/50 uppercase mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Arcade "INSERT COIN" blinking prompt ── */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 transition-all duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "2.5s" }}
      >
        <span
          className="font-arcade text-[7px] md:text-[8px] tracking-[0.3em] uppercase text-[#D64D8D]/70"
          style={{ animation: "arcade-blink 1.2s step-end infinite" }}
        >
          ▼ SCROLL TO EXPLORE ▼
        </span>
      </div>
    </section>
  );
}
