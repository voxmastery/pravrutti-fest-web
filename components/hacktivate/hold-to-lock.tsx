"use client";

import { useEffect, useRef, useState } from "react";
import { HOLD_MS } from "@/lib/track-pick";

/**
 * Press-and-hold for about two seconds. Releasing, blurring, or a cancelled
 * pointer abandons the lock. Space and Enter do the same thing as a finger,
 * so it is usable without a pointer.
 */
export function HoldToLock({
  disabled,
  busy,
  onComplete,
}: {
  disabled?: boolean;
  busy?: boolean;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const holding = useRef(false);
  const done = useRef(false);
  const start = useRef(0);
  const raf = useRef<number | null>(null);

  const stop = () => {
    holding.current = false;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (!done.current) setProgress(0);
  };

  /* Cancel and Escape unmount this button while a finger or key is still down.
     The frame has to die with the button, or the lock fires after they backed out. */
  useEffect(() => {
    return () => {
      holding.current = false;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, []);

  const tick = (t: number) => {
    if (!holding.current || done.current) return;
    const next = Math.min(1, (t - start.current) / HOLD_MS);
    setProgress(next);
    if (next >= 1) {
      holding.current = false;
      done.current = true;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      onComplete();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (disabled || busy || done.current || holding.current) return;
    holding.current = true;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };

  const label = busy ? "LOCKING IN…" : "HOLD TO LOCK IN";

  return (
    <button
      type="button"
      data-testid="hold-to-lock"
      disabled={disabled || busy}
      aria-disabled={disabled || busy}
      aria-label={busy ? "Locking in" : "Hold to lock in. Press and hold for 2 seconds. Releasing cancels."}
      aria-describedby="hold-to-lock-hint"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a convenience; the button still works without it */
        }
        begin();
      }}
      onPointerUp={() => stop()}
      onPointerCancel={() => stop()}
      onKeyDown={(e) => {
        if (e.repeat) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          stop();
        }
      }}
      onBlur={() => stop()}
      className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl border border-cyber-pink bg-midnight-navy font-display text-xs font-bold tracking-[0.18em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void-black disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-cyber-pink"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative px-3">{label}</span>
    </button>
  );
}
