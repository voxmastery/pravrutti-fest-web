"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated SVG circuit/wire lines that pulse and glow.
 * Creates a living, breathing network of energy lines across the hero.
 */
export function CircuitLines() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Animated glow filter */}
          <filter id="circuit-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Pulse gradient for energy traveling along wires */}
          <linearGradient id="wire-pulse-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor="#D64D8D" stopOpacity="0" />
            <stop offset="50%" stopColor="#D64D8D" stopOpacity="0.8">
              <animate attributeName="offset" values="0;1" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="60%" stopColor="#D64D8D" stopOpacity="0">
              <animate attributeName="offset" values="0.1;1.1" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          <linearGradient id="wire-pulse-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor="#F2D2AE" stopOpacity="0" />
            <stop offset="50%" stopColor="#F2D2AE" stopOpacity="0.6">
              <animate attributeName="offset" values="0;1" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="60%" stopColor="#F2D2AE" stopOpacity="0">
              <animate attributeName="offset" values="0.1;1.1" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          <linearGradient id="wire-pulse-3" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="45%" stopColor="#AC355D" stopOpacity="0" />
            <stop offset="50%" stopColor="#AC355D" stopOpacity="0.5">
              <animate attributeName="offset" values="0;1" dur="5s" repeatCount="indefinite" />
            </stop>
            <stop offset="55%" stopColor="#AC355D" stopOpacity="0">
              <animate attributeName="offset" values="0.05;1.05" dur="5s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Static circuit framework — very subtle */}
        <g opacity="0.08" stroke="#721F4C" strokeWidth="1" fill="none">
          {/* Horizontal wires */}
          <path d="M0,200 L400,200 L420,180 L600,180" />
          <path d="M0,400 L300,400 L340,440 L500,440 L520,400 L800,400" />
          <path d="M0,700 L250,700 L270,720 L450,720" />
          <path d="M1920,300 L1500,300 L1480,320 L1300,320" />
          <path d="M1920,600 L1600,600 L1580,580 L1400,580 L1380,600 L1200,600" />
          <path d="M1920,850 L1700,850 L1680,830 L1500,830" />
          {/* Vertical wires */}
          <path d="M300,0 L300,150 L320,170 L320,300" />
          <path d="M1600,0 L1600,200 L1580,220 L1580,350" />
          <path d="M300,1080 L300,900 L320,880 L320,750" />
          <path d="M1620,1080 L1620,920 L1600,900 L1600,800" />
        </g>

        {/* Pulsing energy wires — horizontal */}
        <g strokeWidth="1.5" fill="none" filter="url(#circuit-glow)">
          {/* Left side - flows right */}
          <path
            d="M-50,250 L200,250 L230,220 L500,220 L530,250 L750,250 L780,220 L960,220"
            stroke="url(#wire-pulse-1)"
            opacity="0.6"
          />
          {/* Right side - flows left */}
          <path
            d="M1970,450 L1700,450 L1670,480 L1400,480 L1370,450 L1150,450 L1120,480 L960,480"
            stroke="url(#wire-pulse-1)"
            opacity="0.5"
          />
          {/* Bottom left */}
          <path
            d="M-50,780 L180,780 L200,760 L400,760 L430,780 L650,780"
            stroke="url(#wire-pulse-3)"
            opacity="0.45"
          />
          {/* Bottom right */}
          <path
            d="M1970,700 L1750,700 L1720,720 L1500,720 L1470,700 L1300,700"
            stroke="url(#wire-pulse-3)"
            opacity="0.4"
          />
        </g>

        {/* Pulsing energy wires — vertical */}
        <g strokeWidth="1.5" fill="none" filter="url(#circuit-glow)">
          <path
            d="M400,0 L400,180 L380,200 L380,350 L400,370 L400,500"
            stroke="url(#wire-pulse-2)"
            opacity="0.3"
          />
          <path
            d="M1520,0 L1520,220 L1540,240 L1540,400 L1520,420 L1520,540"
            stroke="url(#wire-pulse-2)"
            opacity="0.25"
          />
          <path
            d="M250,1080 L250,900 L270,880 L270,700 L250,680 L250,550"
            stroke="url(#wire-pulse-2)"
            opacity="0.25"
          />
          <path
            d="M1680,1080 L1680,850 L1660,830 L1660,680 L1680,660 L1680,540"
            stroke="url(#wire-pulse-2)"
            opacity="0.2"
          />
        </g>

        {/* Junction nodes — small glowing dots at wire intersections */}
        <g fill="#D64D8D" opacity="0.4">
          <circle cx="400" cy="200" r="2.5">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="530" cy="250" r="2">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="1400" cy="480" r="2.5">
            <animate attributeName="opacity" values="0.2;0.9;0.2" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="1520" cy="240" r="2">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="250" cy="700" r="2">
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="1680" cy="830" r="2">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Gold accent nodes */}
        <g fill="#F2D2AE" opacity="0.3">
          <circle cx="320" cy="300" r="1.5">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="1580" cy="350" r="1.5">
            <animate attributeName="opacity" values="0.1;0.5;0.1" dur="5s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Mouse-reactive glow spot */}
        <circle
          cx={mousePos.x * 1920}
          cy={mousePos.y * 1080}
          r="120"
          fill="url(#mouse-glow)"
          opacity="0.15"
          style={{ transition: "cx 0.3s ease-out, cy 0.3s ease-out" }}
        />
        <radialGradient id="mouse-glow">
          <stop offset="0%" stopColor="#D64D8D" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#D64D8D" stopOpacity="0" />
        </radialGradient>
      </svg>
    </div>
  );
}
