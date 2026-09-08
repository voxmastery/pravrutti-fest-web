import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { EventPageView } from "@/components/event-page-view";
import { events, eventId, FEST } from "@/lib/pravrutti-data";

export function generateStaticParams() {
  return events.map((e) => ({ slug: eventId(e.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = events.find((e) => eventId(e.name) === slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.name} · ${FEST.name}`,
    description: event.description.slice(0, 155),
    openGraph: {
      title: `${event.name} · ${FEST.name}`,
      description: event.description.slice(0, 155),
    },
  };
}

/**
 * Stays a Server Component for the metadata and the static params; the layout
 * itself is a client component because the location, the hosts' numbers and
 * the viewer's own registration status all depend on who is asking, and none of
 * that may be prerendered into the HTML.
 */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = events.find((e) => eventId(e.name) === slug);
  if (!event) notFound();

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      {/* No site header on phones, so the Luma bar can sit flush with the top. */}
      <div className="relative z-10 flex-1 w-full min-w-0 max-w-[1100px] mx-auto px-6 pt-0 pb-20 lg:pt-36 lg:pb-28">
        <EventPageView event={event} slug={slug} />
      </div>

      <div className="max-lg:hidden">
        <FooterSection />
      </div>
    </main>
  );
}
