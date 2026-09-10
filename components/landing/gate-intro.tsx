"use client";

import { useState, useEffect, useRef } from "react";

/** Assets the hero needs before it is worth revealing. */
const CRITICAL_ASSETS = ["/pravrutti-logo.png", "/gate-temple.png"];

/**
 * Long enough that the wordmark actually registers. Assets are usually cached
 * on a second visit, so without a floor the whole intro flickers past in ~200ms
 * and reads as a glitch rather than an entrance.
 */
const MIN_DURATION = 1900;
/** Never hold hostage — reveal regardless once this elapses. */
const MAX_DURATION = 5000;

export function GateIntro({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "revealing" | "done">("loading");
  const [logoReady, setLogoReady] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    // The intro plays on every load of the homepage. It previously skipped
    // itself after the first view via sessionStorage, which made it impossible
    // to see again without clearing storage — surprising for visitors and
    // actively unhelpful while designing it.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = Date.now();
    let settled = false;

    const finish = () => {
      if (settled || doneRef.current) return;
      settled = true;
      doneRef.current = true;
      setProgress(100);
      setPhase("revealing");
      // Let the cross-fade play out before unmounting the overlay.
      window.setTimeout(() => {
        setPhase("done");
        onComplete();
      }, reducedMotion ? 120 : 900);
    };

    // Decode the assets the hero opens onto, so the reveal lands on a painted page
    // instead of a half-loaded one.
    let loaded = 0;
    const assetPromises = CRITICAL_ASSETS.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const settle = () => {
            loaded += 1;
            if (src.includes("pravrutti-logo")) setLogoReady(true);
            resolve();
          };
          img.onload = settle;
          img.onerror = settle; // a missing asset must not wedge the gate
          img.src = src;
        })
    );

    Promise.all(assetPromises).then(() => {
      const elapsed = Date.now() - start;
      window.setTimeout(finish, Math.max(0, MIN_DURATION - elapsed));
    });

    // Hard ceiling — slow network or a stalled decode still reveals the site.
    const ceiling = window.setTimeout(finish, MAX_DURATION);

    // Progress blends real asset completion with elapsed time so the bar always
    // advances, but snaps ahead when the assets actually land.
    const ticker = window.setInterval(() => {
      if (settled) return;
      const elapsed = Date.now() - start;
      const byTime = Math.min(92, (elapsed / MIN_DURATION) * 92);
      const byAssets = (loaded / CRITICAL_ASSETS.length) * 100;
      setProgress((p) => Math.min(99, Math.max(p, byTime, byAssets * 0.9)));
    }, 40);

    return () => {
      window.clearTimeout(ceiling);
      window.clearInterval(ticker);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  const revealing = phase === "revealing";

  return (
    <div
      /* gate-failsafe is a pure-CSS dissolve that needs no JavaScript — see
         app/globals.css. It is the net for a hydration failure, which is the
         one way this overlay could otherwise never go away. */
      className="gate-failsafe fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden flex items-center justify-center px-6" style={{
        // Branded ground from the very first paint — the old flat #000 read as a
        // blank/broken screen while the logo was still downloading.
        background:
          "radial-gradient(ellipse 90% 70% at 50% 42%, #2B122C 0%, #150B1E 38%, #0A0818 70%, #050309 100%)",
        opacity: revealing ? 0 : 1,
        // Long, soft ease-out so the overlay dissolves into the hero rather than
        // snapping away.
        transition: "opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Faint grid so the field has texture instead of reading as empty.
          Kept well below the old strength — with the scanline layer on top it
          muddied the ground it was supposed to quieten. */}
      <div
        className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            "linear-gradient(to right, rgba(114,31,76,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(114,31,76,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse at center, #000 5%, transparent 68%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, #000 5%, transparent 68%)",
        }}
      />

      {/* Central content — drifts up a few pixels as it leaves, which reads as
          the page rising into place instead of the loader zooming at the viewer. */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center w-full" style={{
          transform: revealing ? "translateY(-10px)" : "translateY(0)",
          opacity: revealing ? 0 : 1,
          transition:
            "transform 0.9s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s cubic-bezier(0.4, 0, 1, 1)",
        }}
      >
        {/* Ambient glow — blooms in first, so the field is already alive by the
            time the wordmark lands. */}
        <div
          data-intro-motion
          className="absolute w-[520px] h-[520px] max-w-[110vw] max-h-[110vw] rounded-full pointer-events-none" style={{
            background:
              "radial-gradient(circle, rgba(214,77,141,0.2) 0%, rgba(114,31,76,0.09) 45%, transparent 70%)",
            filter: "blur(30px)",
            animation: "intro-bloom 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        />

        {/* Portal ring — fires only on the way out. */}
        {revealing && (
          <div
            data-intro-motion
            className="absolute w-[320px] h-[320px] max-w-[80vw] max-h-[80vw] rounded-full pointer-events-none border border-cyber-pink" style={{
              animation: "intro-iris 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              boxShadow: "0 0 40px rgba(214,77,141,0.5)",
            }}
          />
        )}

        {/* Wordmark — reserved box keeps the layout stable and prevents the
            "blank screen then pop" the old version produced. */}
        <div
          className="relative mb-10 w-[min(76vw,290px)] sm:w-[min(58vw,350px)] md:w-[400px]" style={{ aspectRatio: "2 / 1" }}
        >
          {/* No skeleton placeholder here. A pulsing block where the wordmark
              belongs reads as a broken image, not as an entrance — and with the
              logo preloaded in the document head it is almost never on screen
              long enough to earn its keep. The reserved box below still holds
              the layout, so nothing shifts when the image lands. */}
          <img
            src="/pravrutti-logo.png" alt="Pravrutti 2.0 — National Tech Fest, RUAS" width={1600}
            height={800}
            onLoad={() => setLogoReady(true)}
            className="relative w-full h-full object-contain" style={{
              opacity: logoReady ? 1 : 0,
              transform: logoReady ? "translateY(0)" : "translateY(6px)",
              transition:
                "opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
              filter: "drop-shadow(0 0 26px rgba(214,77,141,0.3))",
            }}
          />

          {/* Specular sweep — the one signature moment. Masked to the logo art
              so the light travels across the letterforms, not a rectangle. */}
          {logoReady && (
            <div
              data-intro-motion
              className="absolute inset-0 pointer-events-none overflow-hidden" style={{
                maskImage: "url('/pravrutti-logo.png')",
                WebkitMaskImage: "url('/pravrutti-logo.png')",
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            >
              <div
                className="absolute inset-y-0 w-1/3" style={{
                  background:
                    "linear-gradient(100deg, transparent, rgba(255,245,230,0.85), transparent)",
                  animation: "intro-sweep 1.15s cubic-bezier(0.4, 0, 0.2, 1) 0.35s both",
                  mixBlendMode: "screen",
                }}
              />
            </div>
          )}
        </div>

        {/* Progress line — the only chrome. A hairline reads as "loading" without
            competing with the wordmark; the numeric counter and the
            "National Tech Fest · RUAS" subtitle were both removed, the latter
            because the logo artwork already says exactly that. */}
        <div
          className="w-[min(56vw,200px)] md:w-56 h-px bg-pearl-white/12 overflow-hidden relative" style={{
            // Staged: the rule widens into place after the wordmark has settled,
            // so the two don't arrive on top of each other.
            transform: logoReady ? "scaleX(1)" : "scaleX(0.2)",
            opacity: logoReady ? 1 : 0,
            transition:
              "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.25s, opacity 0.5s ease-out 0.25s",
          }}
        >
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyber-pink to-champagne-gold" style={{
              width: `${progress}%`,
              transition: "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
              boxShadow: "0 0 10px rgba(214,77,141,0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
