"use client";

import { useState, useEffect } from "react";

export function GateIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"hold" | "beam" | "open" | "reveal" | "done">("hold");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Loading progress speed
    const loadInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(loadInterval);
          return 100;
        }
        return p + 2;
      });
    }, 20);

    const t1 = setTimeout(() => setPhase("beam"), 1400);
    const t2 = setTimeout(() => setPhase("open"), 2000);
    const t3 = setTimeout(() => setPhase("reveal"), 3200);
    const t4 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 4000);

    return () => {
      clearInterval(loadInterval);
      [t1, t2, t3, t4].forEach(clearTimeout);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  const isOpening = phase === "open" || phase === "reveal";
  const isRevealing = phase === "reveal";

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none pointer-events-none"
      style={{
        opacity: isRevealing ? 0 : 1,
        transition: isRevealing ? "opacity 0.8s ease-in-out" : undefined,
      }}
    >
      {/* LEFT GATE PANEL */}
      <div
        className="absolute top-0 left-0 w-1/2 h-full overflow-hidden border-r border-[#D64D8D]/30"
        style={{
          transform: isOpening ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 1.4s cubic-bezier(0.77, 0, 0.175, 1)",
        }}
      >
        {/* Background Image - Left Half */}
        <div
          className="absolute inset-0 bg-black"
          style={{
            backgroundImage: "url('/gate-temple.png')",
            backgroundSize: "200vw 100vh",
            backgroundPosition: "left center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.85) saturate(1.1)",
          }}
        />

        {/* Dark overlay & grid details */}
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 crt-scanlines opacity-10" />
        
        {/* Ambient side glow */}
        <div className="absolute inset-y-0 right-0 w-[80px] bg-gradient-to-l from-[#D64D8D]/15 to-transparent" />
        
        {/* Cyberpunk corner details */}
        <div className="absolute top-10 left-10 w-10 h-10 border-l-2 border-t-2 border-[#D64D8D]/40" />
        <div className="absolute bottom-10 left-10 w-10 h-10 border-l-2 border-b-2 border-[#D64D8D]/40" />
        
        {/* System log */}
        <div className="absolute bottom-12 left-12 font-mono text-[9px] tracking-[0.3em] text-[#D64D8D]/60 uppercase">
          <div>SYS://GATE.SEC.A</div>
          <div className="text-white/30 mt-1">ESTABLISHING LINK...</div>
        </div>
      </div>

      {/* RIGHT GATE PANEL */}
      <div
        className="absolute top-0 right-0 w-1/2 h-full overflow-hidden border-l border-[#D64D8D]/30"
        style={{
          transform: isOpening ? "translateX(100%)" : "translateX(0)",
          transition: "transform 1.4s cubic-bezier(0.77, 0, 0.175, 1)",
        }}
      >
        {/* Background Image - Right Half */}
        <div
          className="absolute inset-0 bg-black"
          style={{
            backgroundImage: "url('/gate-temple.png')",
            backgroundSize: "200vw 100vh",
            backgroundPosition: "right center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.85) saturate(1.1)",
          }}
        />

        {/* Dark overlay & grid details */}
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 crt-scanlines opacity-10" />

        {/* Ambient side glow */}
        <div className="absolute inset-y-0 left-0 w-[80px] bg-gradient-to-r from-[#D64D8D]/15 to-transparent" />

        {/* Cyberpunk corner details */}
        <div className="absolute top-10 right-10 w-10 h-10 border-r-2 border-t-2 border-[#D64D8D]/40" />
        <div className="absolute bottom-10 right-10 w-10 h-10 border-r-2 border-b-2 border-[#D64D8D]/40" />

        {/* System status */}
        <div className="absolute bottom-12 right-12 text-right font-mono text-[9px] tracking-[0.3em] text-[#D64D8D]/60 uppercase">
          <div>SYS://GATE.SEC.B</div>
          <div className="text-[#F2D2AE]/60 mt-1">ACCESS GRANTED</div>
        </div>
      </div>

      {/* Central Laser Beam (where panels meet) */}
      {!isOpening && (
        <div
          className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 z-10"
          style={{
            width: phase === "beam" ? "40px" : "2px",
            background: phase === "beam"
              ? "linear-gradient(90deg, transparent, rgba(214,77,141,0.5), #fff, rgba(214,77,141,0.5), transparent)"
              : "linear-gradient(180deg, transparent, #D64D8D, #F2D2AE, #D64D8D, transparent)",
            boxShadow: phase === "beam"
              ? "0 0 30px #D64D8D, 0 0 60px #D64D8D"
              : "0 0 15px rgba(214,77,141,0.5)",
            transition: "width 0.4s ease-out, background 0.3s ease",
            opacity: 0.9,
          }}
        />
      )}

      {/* UI Overlay: Loading progress */}
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
        style={{
          opacity: isOpening ? 0 : 1,
          transition: "opacity 0.4s ease-out",
        }}
      >
        {/* Glow backdrop behind loader */}
        <div className="absolute w-[300px] h-[300px] bg-[#D64D8D]/5 rounded-full blur-[80px]" />

        <div className="relative mt-80 flex flex-col items-center gap-3">
          {/* Circular scanner ring */}
          <div className="absolute -inset-8 border border-[#D64D8D]/20 rounded-full animate-spin [animation-duration:10s]" />
          
          <div className="w-48 h-[2px] bg-[#4A1C3A]/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#721F4C] via-[#D64D8D] to-[#F2D2AE]"
              style={{
                width: `${progress}%`,
                transition: "width 0.05s linear",
              }}
            />
          </div>
          <span className="font-mono text-[9px] tracking-[0.4em] text-[#F2D2AE] tabular-nums">
            DECRYPTING PORTAL... {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
