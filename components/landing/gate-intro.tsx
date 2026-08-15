"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, Lock, Unlock, ShieldAlert, Sparkles } from "lucide-react";

export function GateIntro({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "glitch" | "warp" | "done">("loading");
  const [logText, setLogText] = useState("INITIALIZING CORE SYSTEMS...");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Terminal log sequence
  useEffect(() => {
    const logs = [
      "INITIALIZING PEENYA QUANTUM NODE...",
      "AUTHENTICATING RUAS GATEWAY PROTOCOL...",
      "CALIBRATING 25+ TECH ARENAS...",
      "SYNCHRONIZING PRIZE POOL MATRIX...",
      "PORTAL ENERGY AT MAXIMUM...",
      "ACCESS GRANTED // ENGAGING HYPER-GATE"
    ];

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logs.length) {
        setLogText(logs[logIndex]);
        logIndex++;
      }
    }, 400);

    return () => clearInterval(logInterval);
  }, []);

  // Loading progress
  useEffect(() => {
    const start = Date.now();
    const duration = 2400; // 2.4s total load time for snappy feel

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(timer);
        setPhase("glitch");
        setTimeout(() => setPhase("warp"), 300);
        setTimeout(() => {
          setPhase("done");
          onComplete();
        }, 1100);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Particle vortex & energy grid on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Array<{
      x: number;
      y: number;
      angle: number;
      dist: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    // Create 150 energy particles in radial formation
    const colors = ["#D64D8D", "#F2D2AE", "#721F4C", "#AC355D", "#ffffff"];
    for (let i = 0; i < 160; i++) {
      particles.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        dist: Math.random() * Math.max(width, height) * 0.7,
        speed: 1.5 + Math.random() * 3,
        size: 1 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.fillStyle = "rgba(4, 6, 22, 0.25)";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw particle vortex sucking into center portal
      particles.forEach((p) => {
        p.angle += 0.015;
        p.dist -= p.speed;
        if (p.dist <= 0) {
          p.dist = Math.max(width, height) * 0.6;
          p.angle = Math.random() * Math.PI * 2;
        }

        const px = centerX + Math.cos(p.angle) * p.dist;
        const py = centerY + Math.sin(p.angle) * p.dist;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden select-none bg-[#040616] flex items-center justify-center transition-all duration-700 ${
        phase === "warp" ? "scale-150 opacity-0 blur-md" : "scale-100 opacity-100"
      }`}
    >
      {/* Background vortex canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Cyber Grid Lines */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, #721F4C 1px, transparent 1px), linear-gradient(to bottom, #721F4C 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* CRT Scanlines */}
      <div className="absolute inset-0 crt-scanlines opacity-15 pointer-events-none z-10" />

      {/* Glitch Overlay Flash on Finish */}
      {phase === "glitch" && (
        <div className="absolute inset-0 z-50 bg-[#D64D8D]/20 backdrop-invert mix-blend-difference pointer-events-none animate-pulse" />
      )}

      {/* Center Portal Iris Core */}
      <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center max-w-xl">
        
        {/* Holographic Glowing Ring */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-8">
          
          {/* Outer Orbit Ring */}
          <div className="absolute inset-0 rounded-full border border-[#D64D8D]/40 border-dashed animate-[spin_12s_linear_infinite]" />
          
          {/* Reverse Orbit Ring */}
          <div className="absolute inset-4 rounded-full border border-[#F2D2AE]/30 border-dotted animate-[spin_8s_linear_infinite_reverse]" />
          
          {/* Glowing Radial Core */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-[#721F4C] via-[#D64D8D]/20 to-[#F2D2AE]/10 blur-xl animate-pulse" />

          {/* Central Crest / Emblem */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="p-4 rounded-2xl border border-[#D64D8D]/60 bg-black/60 backdrop-blur-md shadow-[0_0_40px_rgba(214,77,141,0.4)]">
              <img
                src="/pravrutti-logo.png"
                alt="Pravrutti Logo"
                className="w-32 md:w-44 h-auto object-contain drop-shadow-[0_0_15px_rgba(214,77,141,0.6)]"
              />
            </div>
          </div>

          {/* Progress Percentage Display around Portal */}
          <div className="absolute -bottom-3 px-4 py-1 rounded-full bg-black/80 border border-[#D64D8D]/60 backdrop-blur-md shadow-[0_0_20px_rgba(214,77,141,0.4)] flex items-center gap-2">
            {progress < 100 ? (
              <Lock className="w-3.5 h-3.5 text-[#D64D8D] animate-pulse" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-green-400" />
            )}
            <span className="font-mono text-xs md:text-sm font-bold text-[#F2D2AE] tracking-widest tabular-nums">
              {progress}%
            </span>
          </div>
        </div>

        {/* Terminal Log Output */}
        <div className="w-full space-y-3">
          {/* Progress Bar Container */}
          <div className="relative w-full h-2 bg-[#150B1E] rounded-full overflow-hidden border border-[#721F4C]/60 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#721F4C] via-[#D64D8D] to-[#F2D2AE] rounded-full transition-all duration-75 shadow-[0_0_12px_#D64D8D]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Live Log Message */}
          <div className="h-6 flex items-center justify-center gap-2 font-mono text-[10px] md:text-xs tracking-[0.25em] text-[#D64D8D] uppercase">
            <Sparkles className="w-3 h-3 text-[#F2D2AE] animate-spin" />
            <span>{logText}</span>
          </div>
        </div>

        {/* Skip Intro Button */}
        <button
          onClick={() => {
            setPhase("done");
            onComplete();
          }}
          className="mt-8 px-4 py-1.5 rounded-full border border-white/10 hover:border-[#D64D8D]/60 bg-black/40 hover:bg-[#D64D8D]/20 text-[9px] font-mono text-white/50 hover:text-[#F2D2AE] tracking-[0.3em] uppercase transition-all duration-300 pointer-events-auto cursor-pointer"
        >
          [ SKIP INTRO ]
        </button>

      </div>
    </div>
  );
}
