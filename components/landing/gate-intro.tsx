"use client";

import { useState, useEffect } from "react";

export function GateIntro({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "opening" | "done">("loading");

  useEffect(() => {
    const start = Date.now();
    const duration = 1800; // 1.8 seconds fast & ultra-smooth load

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => setPhase("opening"), 200);
        setTimeout(() => {
          setPhase("done");
          onComplete();
        }, 1100);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onComplete]);

  if (phase === "done") return null;

  const isOpening = phase === "opening";

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden bg-black flex items-center justify-center">
      {/* Top Shutter Panel */}
      <div
        className="absolute top-0 left-0 w-full h-[50.5%] bg-[#000000] border-b border-[#721F4C]/30 shadow-2xl z-10"
        style={{
          transform: isOpening ? "translateY(-100%)" : "translateY(0%)",
          transition: "transform 0.9s cubic-bezier(0.87, 0, 0.13, 1)",
        }}
      >
        {/* Subtle Ambient Mesh Glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-t from-[#D64D8D]/10 via-[#721F4C]/05 to-transparent blur-3xl pointer-events-none" />
      </div>

      {/* Bottom Shutter Panel */}
      <div
        className="absolute bottom-0 left-0 w-full h-[50.5%] bg-[#000000] border-t border-[#721F4C]/30 shadow-2xl z-10"
        style={{
          transform: isOpening ? "translateY(100%)" : "translateY(0%)",
          transition: "transform 0.9s cubic-bezier(0.87, 0, 0.13, 1)",
        }}
      >
        {/* Subtle Ambient Mesh Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-[#D64D8D]/10 via-[#721F4C]/05 to-transparent blur-3xl pointer-events-none" />
      </div>

      {/* Central Content */}
      <div
        className={`relative z-20 flex flex-col items-center justify-center text-center transition-all duration-700 ${
          isOpening ? "scale-110 opacity-0 blur-sm" : "scale-100 opacity-100"
        }`}
      >
        {/* Ambient Center Glow */}
        <div className="absolute w-[400px] h-[400px] bg-gradient-to-tr from-[#721F4C]/20 via-[#D64D8D]/10 to-[#F2D2AE]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Emblem */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#D64D8D]/30 via-[#721F4C]/20 to-[#F2D2AE]/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
          <img
            src="/pravrutti-logo.png"
            alt="Pravrutti 2.0"
            className="relative w-44 md:w-60 h-auto object-contain drop-shadow-[0_0_25px_rgba(214,77,141,0.5)]"
          />
        </div>

        {/* Subtitle */}
        <div className="font-mono text-[9px] md:text-[11px] tracking-[0.4em] uppercase text-[#F2D2AE]/80 mb-6">
          NATIONAL TECH FEST &bull; RUAS
        </div>

        {/* Sleek Progress Line */}
        <div className="w-56 md:w-72 h-[2px] bg-white/10 rounded-full overflow-hidden relative mb-4">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#721F4C] via-[#D64D8D] to-[#F2D2AE] shadow-[0_0_15px_#D64D8D]"
            style={{
              width: `${progress}%`,
              transition: "width 0.05s linear",
            }}
          />
        </div>

        {/* Modern Tabular Percentage Counter */}
        <div className="flex items-center gap-2 font-mono text-xs md:text-sm tracking-widest text-[#F7EEE4]/60">
          <span className="tabular-nums font-bold text-[#F2D2AE]">{String(progress).padStart(3, "0")}</span>
          <span>/ 100</span>
        </div>
      </div>
    </div>
  );
}
