import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { DocsControlScreen } from "@/components/hacktivate/docs-control-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo videos · Hacktivate · Pravrutti 2.0",
};

export default function HacktivateDocsControlPage() {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white">
      <Navigation />
      <DocsControlScreen />
    </main>
  );
}
