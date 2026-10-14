import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { HacktivateKitScreen } from "@/components/hacktivate/kit-screen";

export const metadata: Metadata = {
  title: "Kit & components · Hacktivate · Pravrutti 2.0",
  description:
    "PCB Cupid kit claim, Arduino setup, and component list for Hacktivate — same flow as Hardware Hackathon 1.0.",
  openGraph: {
    title: "Kit & components · Hacktivate",
    description: "Claim instructions and the on-site component counter with PCB Cupid.",
  },
};

export default function HacktivateKitPage() {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white flex flex-col justify-between">
      <Navigation />
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />
      <HacktivateKitScreen />
      <div className="max-lg:hidden">
        <FooterSection />
      </div>
    </main>
  );
}
