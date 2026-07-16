"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { events, Event } from "@/lib/pravrutti-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Info, Users, Phone, ShieldAlert, Download, User, IndianRupee } from "lucide-react";

export default function EventsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const getPrizes = (type: Event["type"]) => {
    switch (type) {
      case "Visionary":
        return { first: "₹20,000", second: "₹15,000", third: "₹10,000" };
      case "Creator":
        return { first: "₹10,000", second: "₹7,000", third: "₹5,000" };
      case "Explorer":
        return { first: "₹5,000", second: "₹3,000", third: "₹2,000" };
    }
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
    <main className="relative min-h-screen bg-[#000000] overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
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
          <p className="text-xs md:text-sm text-[#F7EEE4]/80 text-center font-sharetech">
            Please refer to the <a href="/schedule" className="font-bold text-[#F2D2AE] underline hover:text-white">Event Schedule</a> before registering to avoid overlaps.
          </p>
        </div>

        {/* Guidelines / Info Banner */}
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-4 p-5 rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/40 backdrop-blur-sm mb-12 text-xs md:text-sm cyber-box">
          <div className="flex gap-3 items-start">
            <Info className="w-4 h-4 text-[#D64D8D] shrink-0 mt-0.5" />
            <span className="text-[#F7EEE4]/70 font-sharetech">Kindly review event rulebooks carefully before registration.</span>
          </div>
          <div className="flex gap-3 items-start">
            <Users className="w-4 h-4 text-[#D64D8D] shrink-0 mt-0.5" />
            <span className="text-[#F7EEE4]/70 font-sharetech">Group events allow up to 4 members per team including the lead.</span>
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
                className="pl-11 pr-4 py-2 border-[#4A1C3A] bg-[#150B1E]/95 backdrop-blur-sm rounded-full text-xs font-sharetech focus:border-[#D64D8D] focus:ring-0 focus-visible:ring-0 h-11 text-[#F7EEE4]"
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue={categories[0]} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="bg-[#150B1E]/80 backdrop-blur-md border border-[#4A1C3A] p-1.5 rounded-xl flex flex-wrap justify-center h-auto font-orbitron">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="rounded-lg px-5 py-2.5 text-xs md:text-sm font-bold tracking-wider cursor-pointer focus-visible:ring-0 data-[state=active]:bg-[#D64D8D] data-[state=active]:text-white"
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
                          className="group relative border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/70 backdrop-blur-sm hover:border-[#D64D8D] transition-all duration-500 overflow-hidden flex flex-col justify-between cyber-box arcade-card-hover"
                        >
                          {/* Inner Content */}
                          <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-orbitron ${getBadgeColors(event.type)}`} variant="outline">
                                {event.type}
                              </Badge>
                              <span className="text-[10px] font-mono text-[#F2D2AE] uppercase font-bold">{event.fee}</span>
                            </div>
                            
                            <div>
                              <h3 className="text-xl font-orbitron font-extrabold text-[#F7EEE4] group-hover:text-[#F2D2AE] transition-colors duration-300 tracking-wide">
                                {event.name}
                              </h3>
                              <span className="text-[10px] text-[#D64D8D] font-mono tracking-widest uppercase block mt-1.5 font-bold">
                                {event.subCategory}
                              </span>
                            </div>

                            <p className="text-xs md:text-sm text-[#F7EEE4]/60 line-clamp-3 leading-relaxed text-justify font-sharetech">
                              {event.description}
                            </p>
                          </div>

                          {/* Footer Action Buttons using arcade-btn and tactile outlines */}
                          <div className="p-4 bg-[#040616]/75 border-t border-[#4A1C3A] mt-auto flex justify-between gap-3 font-orbitron">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(event);
                                setIsDialogOpen(true);
                              }}
                              className="rounded-xl cursor-pointer hover:bg-[#D64D8D]/30 border-[#4A1C3A] text-xs flex-1 h-9 text-[#F2D2AE] font-bold tracking-wider"
                            >
                              <Info className="w-3.5 h-3.5 mr-1" /> DETAILS
                            </Button>
                            <Button
                              size="sm"
                              disabled
                              className="rounded-xl text-xs flex-1 bg-[#AC355D]/10 text-[#AC355D]/60 border border-[#AC355D]/30 h-9 font-bold tracking-wider"
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

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedEvent && (
          <DialogContent className="bg-[#150B1E] border-2 border-[#721F4C] text-[#F7EEE4] max-w-xl p-6 md:p-8 rounded-2xl shadow-2xl cyber-box font-orbitron">
            <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />
            <DialogHeader className="space-y-4 relative z-10">
              <div className="flex justify-between items-center pr-4">
                <Badge className={`rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-bold ${getBadgeColors(selectedEvent.type)}`} variant="outline">
                  {selectedEvent.type} Event
                </Badge>
                <span className="text-xs font-mono text-[#F2D2AE] uppercase font-bold">{selectedEvent.fee}</span>
              </div>
              <DialogTitle className="text-3xl font-orbitron font-extrabold text-[#F2D2AE] tracking-wide">{selectedEvent.name}</DialogTitle>
              <DialogDescription className="text-xs text-[#D64D8D] font-mono tracking-widest uppercase mt-1.5 font-bold">
                {selectedEvent.subCategory}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6 max-h-[60vh] overflow-y-auto pr-2 relative z-10">
              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#D64D8D]">Description</h4>
                <p className="text-xs md:text-sm text-[#F7EEE4]/80 leading-relaxed text-justify font-sharetech">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Cash Prizes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#D64D8D]">HI-SCORE REWARDS</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { place: "1st", amount: getPrizes(selectedEvent.type).first },
                    { place: "2nd", amount: getPrizes(selectedEvent.type).second },
                    { place: "3rd", amount: getPrizes(selectedEvent.type).third }
                  ].map((p) => (
                    <div key={p.place} className="p-3 border border-[#4A1C3A] rounded-xl bg-[#040616] text-center flex flex-col justify-center gap-0.5">
                      <span className="text-[10px] text-[#F7EEE4]/50 uppercase font-bold">{p.place} PLACE</span>
                      <span className="text-base font-bold text-[#F2D2AE] font-mono">{p.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Registration Fee */}
              <div className="p-4 border border-[#721F4C] bg-[#2B122C]/40 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <IndianRupee className="w-4 h-4 text-[#F2D2AE]" />
                  <span className="text-[#F7EEE4]/70 font-bold uppercase tracking-wider text-xs">ENTRY COST:</span>
                </div>
                <span className="font-mono text-base font-bold text-[#F2D2AE]">
                  {selectedEvent.fee === "Free" ? "FREE ENTRY" : selectedEvent.fee}
                </span>
              </div>

              {/* Coordinators */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#D64D8D]">ARENA CONTACTS</h4>
                <div className="space-y-3 font-mono text-xs md:text-sm">
                  {/* Faculty */}
                  {selectedEvent.coordinators.faculty.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase text-[#F7EEE4]/50 font-bold">Faculty Advisory Desk</span>
                      {selectedEvent.coordinators.faculty.map((c) => (
                        <div key={c.name} className="flex justify-between items-center border border-[#4A1C3A] bg-[#040616] px-4 py-2.5 rounded-xl">
                          <span className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-[#F2D2AE]" /> {c.name}</span>
                          <a href={`tel:${c.phone}`} className="font-bold hover:text-[#D64D8D] hover:underline flex items-center gap-1.5 text-[#F2D2AE]"><Phone className="w-3 h-3 text-[#D64D8D]" /> {c.phone}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Student */}
                  {selectedEvent.coordinators.student.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase text-[#F7EEE4]/50 font-bold">Student Arena Lead</span>
                      {selectedEvent.coordinators.student.map((c) => (
                        <div key={c.name} className="flex justify-between items-center border border-[#4A1C3A] bg-[#040616] px-4 py-2.5 rounded-xl">
                          <span className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-[#F2D2AE]" /> {c.name}</span>
                          <a href={`tel:${c.phone}`} className="font-bold hover:text-[#D64D8D] hover:underline flex items-center gap-1.5 text-[#F2D2AE]"><Phone className="w-3 h-3 text-[#D64D8D]" /> {c.phone}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Download Rulebook using arcade-btn */}
              <div className="pt-4 border-t border-[#4A1C3A] flex gap-4">
                <a href={selectedEvent.brochureUrl} download={`${selectedEvent.name}_Rules.pdf`} className="flex-1">
                  <Button className="w-full rounded-xl text-white text-xs h-11 flex items-center justify-center gap-2 cursor-pointer font-bold uppercase tracking-widest arcade-btn-magenta border-[#D64D8D] hover:text-white">
                    <Download className="w-4 h-4" /> DOWNLOAD ROM GUIDE
                  </Button>
                </a>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <FooterSection />
    </main>
  );
}
