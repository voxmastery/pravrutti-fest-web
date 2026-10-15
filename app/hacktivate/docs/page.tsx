import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { HacktivateDocsScreen } from "@/components/hacktivate/docs-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo video · Hacktivate · Pravrutti 2.0",
  description: "Submit your Hacktivate demo video Google Drive link.",
};

export default function HacktivateDocsPage() {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white flex flex-col justify-between">
      <Navigation />
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />
      <HacktivateDocsScreen />
      <div className="max-lg:hidden">
        <FooterSection />
      </div>
    </main>
  );
}
