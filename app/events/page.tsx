"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { events, Event } from "@/lib/pravrutti-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDetailPanel } from "@/components/event-detail-panel";
import { Search, Info, Users, Phone, ShieldAlert, Download, User, IndianRupee, Mail } from "lucide-react";

export default function EventsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const categories: Event["category"][] = [
    "Engineering and Design",
    "Research and Presentation",
    "Code and Compute",
    "Enterprise and Expression"
  ];

  const getFilteredEvents = (category: Event["category"]) => {
    return events.filter(
      (e) =>
        e.category === category &&
        (e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.subCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const getBadgeColors = (type: Event["type"]) => {
    switch (type) {
      case "Visionary":
        return "bg-[#BF8A1B]/20 text-[#F2D2AE] border-[#BF8A1B]/40 font-bold";
      case "Creator":
        return "bg-[#D64D8D]/20 text-[#D64D8D] border-[#D64D8D]/40 font-bold";
      case "Explorer":
        return "bg-[#721F4C]/30 text-[#F7EEE4] border-[#721F4C]/50 font-semibold";
    }
  };

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
          <Tabs defaultValue={categories[0]} className="w-full">
            {/* Category rail.
                The triggers are `whitespace-nowrap` and far too wide to wrap sensibly
                on a phone, so below md the rail scrolls horizontally (bleeding to the
                screen edges to advertise that it scrolls) instead of wrapping into a
                clipped, stuck-looking block. From md up it wraps and centres as before. */}
            <div className="mb-8 -mx-6 px-6 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible no-scrollbar md:flex md:justify-center">
              <TabsList className="bg-[#150B1E]/80 backdrop-blur-md border border-[#4A1C3A] p-1.5 rounded-xl flex w-max md:w-fit md:flex-wrap md:justify-center h-auto gap-1.5 font-orbitron snap-x snap-mandatory">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="flex-none snap-start rounded-lg px-4 sm:px-5 py-3 text-sm md:text-base font-bold tracking-wider cursor-pointer focus-visible:ring-0 data-[state=active]:bg-[#D64D8D] data-[state=active]:text-white"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tabs Content */}
            {categories.map((cat) => {
              const filteredList = getFilteredEvents(cat);
              return (
                <TabsContent key={cat} value={cat} className="focus-visible:ring-0 mt-0">
                  {filteredList.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredList.map((event) => (
                        <div
                          key={event.name}
                          onClick={() => setSelectedEvent(event)}
                          className="group relative cursor-pointer border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/70 backdrop-blur-sm hover:border-[#D64D8D] transition-all duration-500 overflow-hidden flex flex-col justify-between cyber-box arcade-card-hover"
                        >
                          {/* Inner Content */}
                          <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center gap-2">
                              <Badge className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider font-orbitron ${getBadgeColors(event.type)}`} variant="outline">
                                {event.type}
                              </Badge>
                              <span
                                className={`shrink-0 font-orbitron uppercase font-black rounded-full px-3 py-1.5 text-base ${
                                  event.fee.toLowerCase().startsWith("free")
                                    ? "text-[#7BE3A8] bg-[#12B76A]/15 border border-[#12B76A]/45"
                                    : "text-[#F2D2AE] bg-[#BF8A1B]/15 border border-[#BF8A1B]/45"
                                }`}
                              >
                                {event.fee}
                              </span>
                            </div>

                            <div>
                              <h3 className="text-xl md:text-2xl font-orbitron font-extrabold text-[#F7EEE4] group-hover:text-[#F2D2AE] transition-colors duration-300 tracking-wide">
                                {event.name}
                              </h3>
                              <span className="text-xs text-[#D64D8D] font-mono tracking-widest uppercase block mt-2 font-bold">
                                {event.subCategory}
                              </span>
                            </div>

                            <p className="text-sm md:text-base text-[#F7EEE4]/70 line-clamp-3 leading-relaxed font-sharetech">
                              {event.description}
                            </p>
                          </div>

                          {/* Footer Action Buttons using arcade-btn and tactile outlines */}
                          <div className="p-4 bg-[#0A0818]/75 border-t border-[#4A1C3A] mt-auto flex justify-between gap-3 font-orbitron">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEvent(event)}
                              className="rounded-xl cursor-pointer hover:bg-[#D64D8D]/30 border-[#4A1C3A] text-sm flex-1 h-11 text-[#F2D2AE] font-bold tracking-wider"
                            >
                              <Info className="w-4 h-4 mr-1.5" /> DETAILS
                            </Button>
                            <Button
                              size="sm"
                              disabled
                              className="rounded-xl text-sm flex-1 bg-[#AC355D]/10 text-[#AC355D]/70 border border-[#AC355D]/30 h-11 font-bold tracking-wider"
                            >
                              CLOSED
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 border border-dashed border-[#4A1C3A] rounded-2xl bg-[#150B1E]/30 cyber-box">
                      <ShieldAlert className="w-10 h-10 text-[#D64D8D] mx-auto mb-4" />
                      <h3 className="text-lg font-orbitron text-[#F7EEE4] mb-2 font-black">ARENA EMPTY</h3>
                      <p className="text-xs text-[#F7EEE4]/60 font-sharetech">We couldn't find any events matching "{searchQuery}" in this category.</p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>

      {/* Luma-style detail panel */}
      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <FooterSection />
    </main>
  );
}
