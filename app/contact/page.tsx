"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { contacts } from "@/lib/pravrutti-data";
import { Phone, Mail, MapPin, User, Building2 } from "lucide-react";

export default function ContactPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-neon-purple/40" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-royal-wine/40" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-16 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-display tracking-widest text-cyber-pink uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-neon-purple" />
            ORGANIZING HELPDESK
            <span className="w-8 h-px bg-neon-purple" />
          </span>
          <h1 className="text-4xl md:text-7xl font-display tracking-wider text-pearl-white mb-6 font-black">
            CONTACT <span className="text-stroke">SYSTEM</span>
          </h1>
          <p className="text-base md:text-xl text-pearl-white/70 leading-relaxed max-w-2xl mx-auto">
            Questions about registration, events, or finding your way around campus?
            Reach our student and faculty coordinators directly — they&apos;ll get you sorted.
          </p>
        </div>

        {/* Contact Sections Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* Helpdesk Committee inside cyber-box */}
          <div className="p-8 border border-royal-wine rounded-3xl bg-cosmic-purple/60 backdrop-blur-md space-y-6 cyber-box">
            <div className="flex items-center gap-3 pb-4 border-b border-royal-wine font-display">
              <div className="p-3.5 rounded-xl bg-neon-purple/40 text-champagne-gold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-pearl-white tracking-wide">Student Organizers</h3>
                <p className="text-sm text-cyber-pink uppercase tracking-widest font-bold mt-1">Core Helpdesk</p>
              </div>
            </div>

            <div className="space-y-4 text-base">
              {contacts.helpdesk.map((c) => (
                <div key={c.name} className="flex justify-between items-center border border-royal-wine/50 bg-midnight-navy p-4 rounded-xl">
                  <div className="flex flex-col">
                    <span className="font-bold text-pearl-white tracking-wide">{c.name}</span>
                    <span className="text-xs text-pearl-white/55 uppercase font-bold mt-1">Student Lead</span>
                  </div>
                  <a href={`tel:${c.phone}`} className="font-bold text-champagne-gold hover:text-cyber-pink hover:underline flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyber-pink" /> {c.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Official Email & Social */}
          <div className="p-8 border border-royal-wine rounded-3xl bg-cosmic-purple/60 backdrop-blur-md space-y-6 cyber-box">
            <div className="flex items-center gap-3 pb-4 border-b border-royal-wine font-display">
              <div className="p-3.5 rounded-xl bg-neon-purple/40 text-champagne-gold">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-pearl-white tracking-wide">Digital Gateways</h3>
                <p className="text-sm text-cyber-pink uppercase tracking-widest font-bold mt-1">Direct Feeds</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-4 border border-royal-wine/50 bg-midnight-navy rounded-xl space-y-1">
                <span className="text-xs text-pearl-white/65 uppercase font-bold font-display tracking-wider">Email System</span>
                <a href={`mailto:${contacts.email}`} className="block font-bold text-champagne-gold hover:text-cyber-pink hover:underline text-base">
                  {contacts.email}
                </a>
              </div>

              <div className="p-4 border border-royal-wine/50 bg-midnight-navy rounded-xl space-y-1">
                <span className="text-xs text-pearl-white/65 uppercase font-bold font-display tracking-wider">Instagram Feed</span>
                <a href="https://www.instagram.com/pravrutti_ruas" target="_blank" rel="noopener noreferrer" className="block font-bold text-cyber-pink hover:text-champagne-gold hover:underline text-base">
                  @pravrutti_ruas &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Location & Map inside cyber-box bezel */}
        <div className="border border-neon-purple rounded-3xl bg-cosmic-purple/80 backdrop-blur-md p-8 shadow-2xl shadow-neon-purple/25 max-w-4xl mx-auto space-y-6 cyber-box">
          <div className="flex items-start gap-4 pb-6 border-b border-royal-wine font-display">
            <div className="p-3.5 rounded-xl bg-neon-purple/40 text-champagne-gold shrink-0 mt-1">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-pearl-white tracking-wide">{contacts.location.campus}</h3>
              <p className="text-base text-pearl-white/70 mt-1">{contacts.location.address}</p>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-royal-wine h-[360px] w-full">
            <iframe
              src={contacts.location.embedUrl}
              width="100%" height="100%" style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) opacity(0.85)" }}
              allowFullScreen
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Map of the Ramaiah Technology Campus, Bengaluru" />
          </div>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
