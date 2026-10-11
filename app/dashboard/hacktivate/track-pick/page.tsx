import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { TrackControlScreen } from "@/components/hacktivate/track-control-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track Pick Control · Hacktivate · Pravrutti 2.0",
};

export default function TrackControlPage() {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white">
      <Navigation />
      <TrackControlScreen />
    </main>
  );
}
