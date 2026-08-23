"use client";

import { useState, useCallback } from "react";
import { GateIntro } from "@/components/landing/gate-intro";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { SponsorsSection } from "@/components/landing/sponsors-section";
import { FooterSection } from "@/components/landing/footer-section";
import { useGlobalScrollReveal } from "@/hooks/use-animations";

export default function Home() {
  const [gateOpen, setGateOpen] = useState(false);
  useGlobalScrollReveal();

  const handleGateComplete = useCallback(() => setGateOpen(true), []);

  return (
    <>
      {/* Gate overlay sits on TOP — site is always rendered behind it */}
      {!gateOpen && <GateIntro onComplete={handleGateComplete} />}

      {/* Site is always visible — gate just covers it until it opens */}
      <main className="relative min-h-screen overflow-x-hidden bg-transparent text-[#F7EEE4]">
        <Navigation />
        <HeroSection />
        <HowItWorksSection />
        <PricingSection />
        {/* Sponsors sit above clubs: partners who fund the fest get the
            higher slot on the page. */}
        <SponsorsSection />
        <IntegrationsSection />
        <FooterSection />
      </main>
    </>
  );
}
