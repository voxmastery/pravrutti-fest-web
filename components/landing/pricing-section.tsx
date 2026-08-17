"use client";

import { useRef } from "react";
import { Check, Zap, Trophy, Award, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useScrollReveal, useMousePosition } from "@/hooks/use-animations";

// Ordered high -> low so the tier NUMBER always tracks the prize size.
// Previously Tier 02 held the largest pool (₹45,000) and Tier 03 the second
// largest (₹22,000), which read as a broken hierarchy.
const tiers = [
  {
    name: "VISIONARY",
    icon: Trophy,
    pool: "₹45,000",
    description: "Flagship high-impact innovation challenges",
    prizes: ["1st: ₹20,000", "2nd: ₹15,000", "3rd: ₹10,000"],
    extras: ["Incubation Support", "National Recognition"],
    highlight: true,
    accent: "#D64D8D",
  },
  {
    name: "CREATOR",
    icon: Award,
    pool: "₹22,000",
    description: "Core technical design & building tasks",
    prizes: ["1st: ₹10,000", "2nd: ₹7,000", "3rd: ₹5,000"],
    extras: ["Certificate of Excellence", "Industry Mentorship"],
    highlight: false,
    accent: "#BF8A1B",
  },
  {
    name: "EXPLORER",
    icon: Star,
    pool: "₹10,000",
    description: "Emerging tech and logical puzzle challenges",
    prizes: ["1st: ₹5,000", "2nd: ₹3,000", "3rd: ₹2,000"],
    extras: ["Participation Certificate", "National Skill Badge"],
    highlight: false,
    accent: "#AC355D",
  },
];

function TierCard({ tier, index }: { tier: typeof tiers[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition(cardRef);
  const Icon = tier.icon;

  return (
    <div
      ref={cardRef}
      className={`reveal-up group relative rounded-2xl border backdrop-blur-sm magnetic-card flex flex-col ${
        tier.highlight
          ? "border-[#D64D8D] bg-[#150B1E]/80 shadow-2xl shadow-[#D64D8D]/15 lg:scale-105 lg:z-10"
          : "border-[#4A1C3A] bg-[#150B1E]/40 neon-border"
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Mouse glow */}
      {mouse.active && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none z-0"
          style={{
            background: `radial-gradient(250px circle at ${mouse.x * 100}% ${mouse.y * 100}%, ${tier.accent}15, transparent 60%)`,
          }}
        />
      )}

      {/* Featured badge */}
      {tier.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#D64D8D] to-[#AC355D] text-white text-[11px] font-mono uppercase tracking-[0.2em] rounded-full shadow-lg">
            <Zap className="w-3.5 h-3.5 fill-white" /> TOP TIER
          </span>
        </div>
      )}

      <div className="relative z-10 p-8 lg:p-10 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <span className="font-mono text-xs md:text-sm tracking-[0.3em] uppercase font-bold" style={{ color: tier.accent }}>
            TIER {String(index + 1).padStart(2, "0")}
          </span>
          <Icon className="w-6 h-6" style={{ color: tier.accent }} />
        </div>

        <h3 className="text-2xl md:text-3xl font-orbitron font-black tracking-wider text-[#F7EEE4] mb-2">{tier.name}</h3>
        <p className="text-sm text-[#F7EEE4]/60 font-mono mb-6">{tier.description}</p>

        {/* Prize pool */}
        <div className="mb-8">
          <span className="block text-4xl md:text-5xl font-orbitron font-black text-[#F2D2AE] tracking-tight drop-shadow-[0_0_16px_rgba(242,210,174,0.25)]">
            {tier.pool}
          </span>
          <span className="text-[#F7EEE4]/50 text-sm font-mono">total pool / per track</span>
        </div>

        {/* Prize breakdown */}
        <div className="space-y-3 mb-8 flex-1">
          {tier.prizes.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <Check className="w-5 h-5 shrink-0" style={{ color: tier.accent }} />
              <span className="text-base text-[#F7EEE4] font-mono font-semibold">{p}</span>
            </div>
          ))}
          {tier.extras.map((e) => (
            <div key={e} className="flex items-center gap-3">
              <Check className="w-5 h-5 shrink-0 text-[#721F4C]" />
              <span className="text-base text-[#F7EEE4]/60 font-mono">{e}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link href="/events" className="block">
          <Button
            className={`w-full rounded-xl font-orbitron text-sm py-6 h-auto font-black tracking-wider cursor-pointer ${
              tier.highlight
                ? "arcade-btn-primary"
                : "arcade-btn text-[#F2D2AE]"
            }`}
          >
            VIEW EVENTS <ArrowRight className="w-3.5 h-3.5 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function PricingSection() {
  const headerRef = useScrollReveal();

  return (
    <section className="relative py-28 lg:py-36 bg-black overflow-hidden border-t border-[#4A1C3A]/40">
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-[#721F4C]/6 rounded-full blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div ref={headerRef} className="reveal-up text-center max-w-3xl mx-auto mb-20">
          <span className="inline-flex items-center gap-3 font-mono text-xs md:text-sm tracking-[0.28em] uppercase text-[#D64D8D] mb-6">
            <span className="w-10 h-px bg-[#721F4C]" />
            REWARDS
            <span className="w-10 h-px bg-[#721F4C]" />
          </span>
          <h2 className="text-4xl md:text-6xl font-orbitron font-black tracking-wider">
            PRIZE <span className="text-stroke">TIERS</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-[#F7EEE4]/70 font-mono max-w-xl mx-auto">
            Three event tiers, listed highest pool first. Tier 01 carries the biggest challenges and the biggest rewards.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-4 items-stretch">
          {tiers.map((tier, i) => (
            <TierCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Bottom associations */}
        <div className="reveal-up mt-20 flex flex-wrap items-center justify-center gap-8 pt-10 border-t border-[#4A1C3A]/40">
          {["IEEE In-Association", "ISTE In-Association", "Incubation Support Available"].map((s) => (
            <span key={s} className="flex items-center gap-2 text-sm font-mono text-[#F7EEE4]/60 tracking-wider">
              <Check className="w-4 h-4 text-[#D64D8D]" /> {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
export default PricingSection;
