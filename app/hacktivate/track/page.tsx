import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { TrackPickScreen } from "@/components/hacktivate/track-pick-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pick your track · Hacktivate · Pravrutti 2.0",
  description: "Confirmed Hacktivate teams lock one track. Opens 11 Oct 2026, 10:00 AM IST.",
};

export default function HacktivateTrackPage() {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white">
      <Navigation />
      <TrackPickScreen />
    </main>
  );
}
