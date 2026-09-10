"use client";

import { useRef, useState } from "react";
import { Compass, UserPlus, Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useScrollReveal, useMousePosition } from "@/hooks/use-animations";
import { PALETTE } from "@/lib/palette";

const steps = [
  {
    number: "01",
    title: "CHOOSE YOUR ARENA",
    icon: Compass,
    description: "Browse 24 technical challenges across Engineering & Design, Code & Compute, Research & Presentation, and Enterprise & Expression.",
    color: PALETTE.cyberPink,
  },
  {
    number: "02",
    title: "BUILD YOUR SQUAD",
    icon: UserPlus,
    description: "Form a team of up to 4 innovators or go solo. Register online before the deadline closes.",
    color: PALETTE.champagneGold,
  },
  {
    number: "03",
    title: "CLAIM YOUR GLORY",
    icon: Trophy,
    description: "Prepare your solution, pitch to industry experts, and compete for cash prizes.",
    color: PALETTE.softGold,
  },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition(cardRef);

  const tiltX = (mouse.y - 0.5) * -8;
  const tiltY = (mouse.x - 0.5) * 8;
  const Icon = step.icon;

  return (
    <div
      ref={cardRef}
      className="reveal-up group relative p-8 lg:p-10 rounded-2xl border border-royal-wine bg-cosmic-purple/40 backdrop-blur-sm neon-border magnetic-card cursor-default" style={{
        transitionDelay: `${index * 150}ms`,
        transform: mouse.active
          ? `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` : undefined,
      }}
    >
      {/* Mouse glow follow */}
      {mouse.active && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none z-0" style={{
            background: `radial-gradient(300px circle at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(214, 77, 141, 0.08), transparent 60%)`,
          }}
        />
      )}

      <div className="relative z-10">
        {/* Number + Icon */}
        <div className="flex justify-between items-center mb-8">
          <span
            className="text-5xl md:text-6xl font-display font-black transition-all" style={{
              color: step.color,
              // Solid, full-opacity numerals with a matching glow. These used to sit at
              // opacity-20, which made 02 and 03 all but invisible on the dark panel.
              textShadow: `0 0 18px ${step.color}66, 0 0 42px ${step.color}33`,
            }}
          >
            {step.number}
          </span>
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{
              background: `linear-gradient(135deg, ${step.color}30, ${step.color}10)`,
              border: `1px solid ${step.color}40`,
            }}
          >
            <Icon className="w-6 h-6" style={{ color: step.color }} />
          </div>
        </div>

        <h3 className="text-xl md:text-2xl font-display font-black text-pearl-white mb-4 tracking-wider group-hover:text-champagne-gold transition-colors">
          {step.title}
        </h3>

        <p className="text-base text-pearl-white/70 leading-relaxed">
          {step.description}
        </p>

        {/* Bottom progress line */}
        <div className="mt-8 h-px bg-royal-wine overflow-hidden rounded-full">
          <div
            className="h-full w-0 group-hover:w-full transition-all duration-700" style={{ background: `linear-gradient(90deg, ${step.color}, transparent)` }}
          />
        </div>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const headerRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <section className="relative py-28 lg:py-36 bg-midnight-navy overflow-hidden border-t border-royal-wine/40">
      {/* Background ambient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-neon-purple/8 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-20">
          <span className="inline-flex items-center gap-3 text-xs md:text-sm tracking-[0.28em] uppercase text-cyber-pink mb-6">
            <span className="w-10 h-px bg-neon-purple" />
            HOW TO PARTICIPATE
            <span className="w-10 h-px bg-neon-purple" />
          </span>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-wider">
            THREE <span className="text-stroke">STEPS</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-pearl-white/70 max-w-xl mx-auto">
            From choosing your challenge to winning prizes — here's your roadmap.
          </p>
        </div>

        {/* Cards grid with individual scroll reveal */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* CTA */}
        <div ref={ctaRef} className="reveal-up text-center">
          <Button asChild className="arcade-btn-primary rounded-xl font-display text-xs px-10 py-6 h-auto font-black tracking-wider cursor-pointer">
            <Link href="/events">
              VIEW ALL EVENTS <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
export default HowItWorksSection;
