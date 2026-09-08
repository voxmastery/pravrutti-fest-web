"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 35;

const colors = [
  "rgba(214, 77, 141, 0.6)",  // cyber pink
  "rgba(172, 53, 93, 0.5)",   // electric magenta
  "rgba(242, 210, 174, 0.4)", // champagne gold
  "rgba(114, 31, 76, 0.5)",   // neon purple
  "rgba(191, 138, 27, 0.3)",  // soft gold
];

export function FloatingParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any existing
    container.innerHTML = "";

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";

      const size = Math.random() * 4 + 1;
      const left = Math.random() * 100;
      const delay = Math.random() * 20;
      const duration = Math.random() * 15 + 10;
      const drift = (Math.random() - 0.5) * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];

      particle.style.cssText = ` width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        bottom: -10px;
        background: ${color};
        box-shadow: 0 0 ${size * 3}px ${color};
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        --drift: ${drift}px;
      `;

      container.appendChild(particle);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none z-[2]" aria-hidden="true" />
  );
}
