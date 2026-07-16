"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Timer, Download } from "lucide-react";
import { FloatingParticles } from "./floating-particles";
import { CircuitLines } from "./circuit-lines";
import { useParallax, useMousePosition } from "@/hooks/use-animations";

export function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [gateImgReady, setGateImgReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const logoRef = useRef<HTMLDivElement>(null);
  const parallaxOffset = useParallax(0.2);
  const mouse = useMousePosition(logoRef);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 300);
    // Gate image fades in with delay (after gate intro finishes)
    const t2 = setTimeout(() => setGateImgReady(true), 1200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

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

  const tiltX = (mouse.y - 0.5) * -10;
  const tiltY = (mouse.x - 0.5) * 10;

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black select-none">

      {/* ===== LAYER 0: Deep gradient background ===== */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#040616] via-black to-black" />

      {/* ===== LAYER 1: Gate temple — faded atmospheric backdrop ===== */}
      <div
        className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none"
        style={{
          opacity: gateImgReady ? 1 : 0,
          transition: "opacity 3s ease-in-out",
        }}
      >
        <img
          src="/gate-temple.png"
          alt=""
          aria-hidden="true"
          className="w-[750px] md:w-[950px] lg:w-[1200px] h-auto object-contain select-none"
          style={{
            opacity: 0.11,
            transform: `translateY(${-30 + (-parallaxOffset * 0.12)}px) scale(1.05)`,
            transition: "transform 0.3s ease-out",
            filter: "blur(1.5px) saturate(0.8) brightness(0.6)",
            maskImage: "radial-gradient(ellipse 75% 70% at center 45%, black 25%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 70% at center 45%, black 25%, transparent 80%)",
          }}
        />
      </div>

      {/* ===== LAYER 2: Retro perspective grid ===== */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <div
          className="retro-grid"
          style={{ transform: `perspective(500px) rotateX(65deg) translateY(${parallaxOffset * 0.15}px)` }}
        />
      </div>

      {/* ===== LAYER 3: Circuit wire animations ===== */}
      <CircuitLines />

      {/* ===== LAYER 4: Floating particles ===== */}
      <FloatingParticles />

      {/* ===== LAYER 5: CRT scanlines ===== */}
      <div className="absolute inset-0 z-[5] pointer-events-none crt-scanlines" style={{ opacity: 0.05 }} />

      {/* ===== LAYER 6: Radial glow behind center ===== */}
      <div
        className="absolute z-[6] pointer-events-none rounded-full"
        style={{
          width: "800px",
          height: "600px",
          left: "50%",
          top: "35%",
          transform: `translate(-50%, -50%) translateY(${-parallaxOffset * 0.1}px)`,
          background: "radial-gradient(ellipse, rgba(214,77,141,0.06) 0%, rgba(114,31,76,0.02) 40%, transparent 70%)",
        }}
      />

      {/* ===== LAYER 7: Animated rotating arcs around logo ===== */}
      <div
        className="absolute z-[7] pointer-events-none"
        style={{
          width: "550px",
          height: "550px",
          left: "50%",
          top: "35%",
          transform: `translate(-50%, -50%) translateY(${-parallaxOffset * 0.08}px)`,
        }}
      >
        {/* Outer ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 550 550" fill="none">
          <circle cx="275" cy="275" r="250" stroke="#721F4C" strokeWidth="0.5" strokeDasharray="6 25" opacity="0.15">
            <animateTransform attributeName="transform" type="rotate" values="0 275 275;360 275 275" dur="80s" repeatCount="indefinite" />
          </circle>
          <circle cx="275" cy="275" r="230" stroke="#4A1C3A" strokeWidth="0.5" strokeDasharray="3 35" opacity="0.1">
            <animateTransform attributeName="transform" type="rotate" values="360 275 275;0 275 275" dur="60s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Corner tick marks */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-gradient-to-b from-[#D64D8D]/20 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-4 bg-gradient-to-t from-[#D64D8D]/20 to-transparent" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-4 bg-gradient-to-r from-[#D64D8D]/20 to-transparent" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-4 bg-gradient-to-l from-[#D64D8D]/20 to-transparent" />
      </div>

      {/* ===== LAYER 8: Left HUD Telemetry Column ===== */}
      <div className="hidden xl:flex flex-col gap-6 absolute left-10 top-[28%] z-10 w-52 font-mono text-[9px] text-[#D64D8D]/40 text-left border-l border-[#721F4C]/30 pl-5 py-4">
        <div className="space-y-1 text-[#F2D2AE]/60 font-semibold tracking-wider">
          <div>// PROTOCOL LOG</div>
          <div className="h-[1px] bg-[#721F4C]/40 w-16" />
        </div>
        <div className="space-y-2 select-none pointer-events-none">
          <div className="flex gap-2"><span className="text-[#D64D8D]/60">&gt;</span> <span>SYS.INIT: OK</span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]/60">&gt;</span> <span>PEENYA_NODE: UP</span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]/60">&gt;</span> <span>SEC_SHIELD: 98.2%</span></div>
          <div className="flex gap-2"><span className="text-[#D64D8D]/60">&gt;</span> <span className="animate-pulse">DECRYPTING...</span></div>
        </div>
        <div className="text-[8px] text-[#4A1C3A] leading-relaxed mt-2 uppercase">
          <div>LOC: BENGALURU, IN</div>
          <div>NET: PRAVRUTTI_GATE_01</div>
          <div>PORT: 2026//ACTIVE</div>
        </div>
      </div>

      {/* ===== LAYER 9: Right HUD Telemetry Column ===== */}
      <div className="hidden xl:flex flex-col gap-6 absolute right-10 top-[28%] z-10 w-52 font-mono text-[9px] text-[#D64D8D]/40 text-right border-r border-[#721F4C]/30 pr-5 py-4">
        <div className="space-y-1 text-[#F2D2AE]/60 font-semibold tracking-wider">
          <div>// STATUS OVERVIEW</div>
          <div className="h-[1px] bg-[#721F4C]/40 w-16 ml-auto" />
        </div>
        <div className="space-y-2 select-none pointer-events-none">
          <div>STABILITY: STABLE</div>
          <div>BANDWIDTH: OPTIMAL</div>
          <div>HOST: RUAS_NEXUS</div>
          <div className="text-[#D64D8D]/60">CORPUS: OPERATIONAL</div>
        </div>
        <div className="space-y-1 mt-2 text-[8px]">
          <div className="text-white/20">0x7F 0x02 0xAA 0x1B</div>
          <div className="text-white/20">0x04 0xF2 0xD2 0xAE</div>
          <div className="text-white/20">0x9C 0x72 0x1F 0x4C</div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-20 pb-12 flex flex-col items-center text-center">

        {/* University pill */}
        <div
          className={`mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
        >
          <span className="inline-flex items-center gap-2 font-mono text-[8px] md:text-[9px] tracking-[0.3em] uppercase text-[#D64D8D]/70 border border-[#721F4C]/25 bg-[#150B1E]/20 backdrop-blur-sm px-3.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D64D8D] animate-pulse" />
            Ramaiah University of Applied Sciences
          </span>
        </div>

        {/* THE LOGO */}
        <div
          ref={logoRef}
          className={`relative mb-1 cursor-default transition-all duration-[2.5s] ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          style={{ transitionDelay: "0.2s" }}
        >
          {/* Ambient glow */}
          <div
            className="absolute -inset-16 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(214,77,141,0.04) 0%, transparent 65%)",
              filter: "blur(25px)",
            }}
          />

          <img
            src="/pravrutti-logo.jpeg"
            alt="Pravrutti 2.0"
            className="relative w-[320px] md:w-[440px] lg:w-[540px] h-auto object-contain select-none"
            draggable={false}
            style={{
              transform: mouse.active
                ? `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(${-parallaxOffset * 0.08}px)`
                : `translateY(${-parallaxOffset * 0.08}px)`,
              transition: mouse.active ? "transform 0.15s ease-out" : "transform 0.6s ease-out",
              filter: "drop-shadow(0 0 40px rgba(214,77,141,0.18)) drop-shadow(0 0 80px rgba(114,31,76,0.08))",
              maskImage: "radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%)",
            }}
          />
        </div>

        {/* Tagline */}
        <div
          className={`mb-2.5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "0.6s" }}
        >
          <h1
            className="glitch-text font-orbitron text-base md:text-xl lg:text-2xl font-black tracking-[0.15em] text-[#F2D2AE]"
            data-text="CODE. CREATE. INNOVATE. ELEVATE."
          >
            CODE. CREATE. INNOVATE. ELEVATE.
          </h1>
        </div>

        {/* Description */}
        <p
          className={`max-w-lg text-[10px] md:text-xs text-[#F7EEE4]/40 leading-relaxed font-mono mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "0.8s" }}
        >
          Step through the gate into RUAS Peenya campus.
          <br className="hidden md:block" />
          25+ technical arenas &bull; ₹2,00,000+ prize pool &bull; 3 days.
        </p>

        {/* Countdown */}
        <div
          className={`mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1s" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2.5">
            <Timer className="w-3 h-3 text-[#D64D8D]/60 animate-pulse" />
            <span className="font-mono text-[7px] tracking-[0.3em] uppercase text-[#721F4C]">Portal Opens In</span>
          </div>
          <div className="flex gap-2.5 md:gap-3">
            {[
              { v: timeLeft.days, l: "DAYS" },
              { v: timeLeft.hours, l: "HRS" },
              { v: timeLeft.minutes, l: "MIN" },
              { v: timeLeft.seconds, l: "SEC" },
            ].map((t) => (
              <div key={t.l} className="flex flex-col items-center">
                <div className="relative w-12 md:w-14 h-12 md:h-14 flex items-center justify-center rounded-lg border border-[#4A1C3A]/30 bg-[#0a0412]/50 backdrop-blur-sm overflow-hidden group hover:border-[#D64D8D]/30 transition-colors">
                  <div className="absolute inset-0 crt-scanlines opacity-10 pointer-events-none" />
                  <span className="relative font-vt323 text-xl md:text-2xl text-[#F2D2AE] tabular-nums group-hover:text-[#D64D8D] transition-colors">{String(t.v).padStart(2, "0")}</span>
                </div>
                <span className="font-mono text-[6px] tracking-[0.2em] text-[#4A1C3A] mt-1 uppercase">{t.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Date */}
        <div
          className={`mb-6 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.2s" }}
        >
          <span className="inline-flex items-center gap-2 font-mono text-[9px] md:text-[10px] tracking-[0.15em] text-[#F7EEE4]/25 border border-[#4A1C3A]/20 bg-[#150B1E]/10 px-3.5 py-1 rounded-full">
            <Calendar className="w-3 h-3 text-[#721F4C]" />
            15th, 16th &amp; 17th October 2026
          </span>
        </div>

        {/* CTA Buttons */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3.5 transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "1.4s" }}
        >
          <Link href="/events">
            <Button
              size="lg"
              className="arcade-btn-primary rounded-xl font-orbitron text-[9px] md:text-[10px] px-7 md:px-9 py-4 h-auto font-black tracking-[0.15em] cursor-pointer"
            >
              EXPLORE EVENTS <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </Link>
          <a href="/Pravrutti_Main_Brochure.pdf" download>
            <Button
              size="lg"
              className="arcade-btn rounded-xl font-orbitron text-[9px] md:text-[10px] px-7 md:px-9 py-4 h-auto font-black tracking-[0.15em] text-[#F2D2AE] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-2" /> BROCHURE
            </Button>
          </a>
        </div>

        {/* Stats */}
        <div
          className={`mt-10 pt-6 border-t border-[#4A1C3A]/15 w-full max-w-xl transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          style={{ transitionDelay: "1.8s" }}
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: "5000+", l: "Participants", c: "text-[#F2D2AE]" },
              { v: "25+", l: "Tech Events", c: "text-[#D64D8D]" },
              { v: "₹2L+", l: "Prize Pool", c: "text-[#BF8A1B]" },
            ].map((s) => (
              <div key={s.l} className="text-center group cursor-default">
                <div className={`text-lg md:text-2xl font-orbitron font-black ${s.c} group-hover:scale-105 transition-transform`}>{s.v}</div>
                <div className="text-[8px] font-mono tracking-[0.2em] text-[#F7EEE4]/20 uppercase mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 transition-all duration-1000 ${isLoaded ? "opacity-30" : "opacity-0"}`} style={{ transitionDelay: "2.5s" }}>
        <span className="font-mono text-[7px] tracking-[0.3em] uppercase text-[#4A1C3A]">Scroll</span>
        <div className="w-3.5 h-6 rounded-full border border-[#4A1C3A]/30 flex items-start justify-center p-0.5">
          <div className="w-0.5 h-1 rounded-full bg-[#D64D8D]/50 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
