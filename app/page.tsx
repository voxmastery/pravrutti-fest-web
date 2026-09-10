"use client";

import { useState, useCallback } from "react";
import { GateIntro } from "@/components/landing/gate-intro";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
// Hidden until sponsors are confirmed — restore this import and the
// <SponsorsSection /> below together.
// import { SponsorsSection } from "@/components/landing/sponsors-section";
import { FooterSection } from "@/components/landing/footer-section";
import { useGlobalScrollReveal } from "@/hooks/use-animations";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { isStaffRole } from "@/lib/staff-cockpit";

export default function Home() {
  const [gateOpen, setGateOpen] = useState(false);
  const me = useIdentity();
  const dash = useDashboardRole();
  useGlobalScrollReveal();

  const handleGateComplete = useCallback(() => setGateOpen(true), []);

  /* Don't paint the visitor hero for a staff session — Navigation will
     send them to /dashboard. Hold the page until the role is known so a
     signed-in organiser never sees the gate open then bounce. */
  if (me.signedIn && (!dash.ready || isStaffRole(dash.role))) {
    return (
      <main className="relative min-h-screen bg-transparent" aria-busy={!dash.ready}>
        <Navigation />
      </main>
    );
  }

  return (
    <>
      {/* Gate overlay sits on TOP — site is always rendered behind it */}
      {!gateOpen && <GateIntro onComplete={handleGateComplete} />}

      {/* Site is always visible — gate just covers it until it opens */}
      <main className="relative min-h-screen overflow-x-hidden bg-transparent text-pearl-white">
        <Navigation />
        <HeroSection />
        <HowItWorksSection />
        {/* Sponsors are hidden until the partner list is confirmed. When it
            is, restore this and the import above; sponsors sit above clubs so
            partners who fund the fest get the higher slot. */}
        {/* <SponsorsSection /> */}
        <IntegrationsSection />
        <FooterSection />
      </main>
    </>
  );
}
