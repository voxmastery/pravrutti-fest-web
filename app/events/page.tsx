"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { events, Event, FEST } from "@/lib/pravrutti-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EventDetailPanel } from "@/components/event-detail-panel";
import { EventPoster } from "@/components/event-poster";
import { Search, Info, Users, ShieldAlert, User, MapPin, Mail, Trophy } from "lucide-react";

export default function EventsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeCategory, setActiveCategory] = useState<Event["category"] | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const categories: Event["category"][] = [
    "Engineering and Design",
    "Research and Presentation",
    "Code and Compute",
    "Enterprise and Expression"
  ];

  /** Short chip labels. "Engineering and Design" never fits a phone row. */
  const SHORT: Record<Event["category"], string> = {
    "Engineering and Design": "Engineering",
    "Research and Presentation": "Research",
    "Code and Compute": "Code",
    "Enterprise and Expression": "Enterprise",
  };

  const matchesSearch = (e: Event) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.subCategory.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  };

  // Everything is visible by default; a chip narrows rather than switches.
  const searched = events.filter(matchesSearch);
  const visible = activeCategory
    ? searched.filter((e) => e.category === activeCategory)
    : searched;

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-[#721F4C]/40"
            style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-[#4A1C3A]/40"
            style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-xs font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-[#721F4C]" />
            LEVEL STAGE SELECT
            <span className="w-8 h-px bg-[#721F4C]" />
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            PRAVRUTTI <span className="text-stroke">EVENTS</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-2xl mx-auto font-sharetech">
            Select your challenge arena. Team up, analyze rulebooks, and battle for the high-score rewards.
          </p>
        </div>

        {/* Advisory Alert */}
        <div className="max-w-3xl mx-auto mb-12 p-4 rounded-xl border border-[#D64D8D]/40 bg-[#150B1E]/95 flex gap-4 items-center justify-center shadow-xl shadow-[#721F4C]/15 cyber-box">
          <Info className="w-5 h-5 text-[#F2D2AE] shrink-0" />
          <p className="text-sm md:text-base text-[#F7EEE4]/85 text-center font-sharetech">
            Please refer to the <a href="/schedule" className="font-bold text-[#F2D2AE] underline hover:text-white">Event Schedule</a> before registering to avoid overlaps.
          </p>
        </div>

        {/* Guidelines / Info Banner */}
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-4 p-5 rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/40 backdrop-blur-sm mb-12 text-sm md:text-base cyber-box">
          <div className="flex gap-3 items-start">
            <Info className="w-4 h-4 text-[#D64D8D] shrink-0 mt-0.5" />
            <span className="text-[#F7EEE4]/70 font-sharetech">Kindly review event rulebooks carefully before registration.</span>
          </div>
          <div className="flex gap-3 items-start">
            <Users className="w-4 h-4 text-[#D64D8D] shrink-0 mt-0.5" />
            <span className="text-[#F7EEE4]/70 font-sharetech">Group events allow up to 4 members per team including the lead.</span>
          </div>
          <div className="flex gap-3 items-start md:col-span-2">
            <Mail className="w-4 h-4 text-[#D64D8D] shrink-0 mt-0.5" />
            <span className="text-[#F7EEE4]/70 font-sharetech">
              After you register, your entry stays &ldquo;in process&rdquo; until we verify the payment.
              Once your payment has been confirmed, you will receive an email confirmation.{" "}
              <a href="/tickets" className="font-bold text-[#F2D2AE] underline hover:text-white">
                Track your registrations
              </a>
              .
            </span>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="space-y-8">
          <div className="flex justify-center max-w-md mx-auto w-full">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D64D8D]" />
              <Input
                placeholder="Search level database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-2 border-[#4A1C3A] bg-[#150B1E]/95 backdrop-blur-sm rounded-full text-base font-sharetech focus:border-[#D64D8D] focus:ring-0 focus-visible:ring-0 h-12 text-[#F7EEE4]"
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="w-full">
            {/* Chips narrow the grid instead of switching it, so nothing is
                hidden by default. Counts set expectation before a click. */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-4 py-2 font-ui text-sm font-medium transition-colors cursor-pointer border ${
                  activeCategory === null
                    ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                    : "bg-white/[0.04] text-white/70 border-white/[0.1] hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                All <span className="opacity-60">{searched.length}</span>
              </button>
              {categories.map((cat) => {
                const n = searched.filter((e) => e.category === cat).length;
                const on = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(on ? null : cat)}
                    className={`rounded-full px-4 py-2 font-ui text-sm font-medium transition-colors cursor-pointer border ${
                      on
                        ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                        : "bg-white/[0.04] text-white/70 border-white/[0.1] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {SHORT[cat]} <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-center font-ui text-sm text-white/40 mb-8">
              {visible.length === events.length
                ? `Showing all ${events.length} events`
                : `${visible.length} of ${events.length} events`}
            </p>

            {visible.length > 0 ? (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                      {visible.map((event) => {
                        const pool =
                          event.type === "Visionary" ? "\u20B945,000"
                          : event.type === "Creator" ? "\u20B922,000"
                          : "\u20B910,000";

                        return (
                          <article
                            key={event.name}
                            onClick={() => setSelectedEvent(event)}
                            className="group cursor-pointer min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/[0.16] transition-colors overflow-hidden flex flex-col"
                          >
                            {/* Cover leads the card. Tier and fee live in the
                                detail panel; the poster carries the card. */}
                            <div className="relative aspect-[4/3] w-full">
                              <EventPoster
                                event={event}
                                name={event.name}
                                className="absolute inset-0 w-full h-full"
                              />
                            </div>

                            <div className="flex flex-col flex-1 p-4 gap-1">
                              <h3 className="font-ui font-semibold text-base text-white leading-snug group-hover:text-[#F2D2AE] transition-colors line-clamp-2">
                                {event.name}
                              </h3>
                              <p className="font-ui text-sm text-white/45 truncate">
                                {event.subCategory}
                              </p>

                              {/* Facts that actually differ between events —
                                  coordinator and campus are identical on all
                                  26 and were only taking up room. */}
                              <div className="mt-auto pt-3 flex items-center gap-4 border-t border-white/[0.07]">
                                <span className="flex items-center gap-1.5 font-ui text-sm text-white/60">
                                  <Trophy className="w-3.5 h-3.5 text-[#F2D2AE] shrink-0" />
                                  {pool}
                                </span>
                                <span className="flex items-center gap-1.5 font-ui text-sm text-white/60">
                                  <Users className="w-3.5 h-3.5 text-[#D64D8D] shrink-0" />
                                  Up to 4
                                </span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
            ) : (
              <div className="text-center py-20 border border-white/[0.08] rounded-2xl bg-white/[0.04]">
                <ShieldAlert className="w-10 h-10 text-[#D64D8D] mx-auto mb-4" />
                <p className="font-ui font-semibold text-white mb-1.5">No events match</p>
                <p className="font-ui text-sm text-white/50">
                  Try a different search, or{" "}
                  <button
                    onClick={() => { setSearchQuery(""); setActiveCategory(null); }}
                    className="text-[#F2D2AE] underline hover:text-[#D64D8D] cursor-pointer"
                  >
                    clear the filters
                  </button>
                  .
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Luma-style detail panel */}
      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <FooterSection />
    </main>
  );
}
