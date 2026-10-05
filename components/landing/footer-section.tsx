"use client";

import { ArrowUpRight, Mail, MapPin, Calendar, Instagram, Globe } from "lucide-react";
import Link from "next/link";
import { contacts } from "@/lib/pravrutti-data";
import { useScrollReveal } from "@/hooks/use-animations";

const footerLinks = {
  Navigate: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Events", href: "/events" },
    { name: "Schedule", href: "/schedule" },
  ],
  Support: [
    { name: "My Tickets", href: "/ticket" },
    { name: "FAQs", href: "/faq" },
    { name: "Contact Us", href: "/contact" },
  ],
};

const socials = [
  { name: "Instagram", href: "https://www.instagram.com/pravrutti_ruas", icon: Instagram },
  { name: "University", href: "https://www.msruas.ac.in", icon: Globe },
  { name: "Email", href: `mailto:${contacts.email}`, icon: Mail },
];

export function FooterSection() {
  const ref = useScrollReveal();

  return (
    <footer className="relative bg-midnight-navy border-t border-royal-wine/40 overflow-hidden">
      {/* Glow line at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-cyber-pink/50 to-transparent" />
      {/* Ambient wash, so the footer reads as part of the page rather than a flat slab */}
      <div
        className="absolute inset-x-0 bottom-0 h-[420px] pointer-events-none" style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 100%, rgba(114,31,76,0.22) 0%, transparent 70%)",
        }}
      />

      <div ref={ref} className="reveal-up relative max-w-[1200px] mx-auto px-6">
        {/* ── Masthead: the fest at a glance ── */}
        <div className="pt-16 pb-12 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16 border-b border-royal-wine/40">
          <div className="space-y-6">
            <Link href="/" className="inline-block">
              <img
                src="/pravrutti-logo.webp" alt="Pravrutti 2.0" width={1600}
                height={800}
                className="h-16 sm:h-20 w-auto object-contain" style={{ filter: "drop-shadow(0 0 16px rgba(214, 77, 141, 0.25))" }}
              />
            </Link>

            <p className="text-base text-pearl-white/70 leading-relaxed max-w-md">
              The flagship national-level technical symposium of Ramaiah University of
              Applied Sciences — three days of building, pitching and competing.
            </p>

            {/* Key facts, so the footer answers "when and where" without a click */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6">
              <span className="inline-flex items-center gap-2.5 text-sm text-champagne-gold">
                <Calendar className="w-4 h-4 text-cyber-pink shrink-0" />
                14–16 October 2026
              </span>
              <span className="inline-flex items-start gap-2.5 text-sm text-pearl-white/70">
                <MapPin className="w-4 h-4 text-cyber-pink shrink-0 mt-0.5" />
                {contacts.location.campus}, Bengaluru
              </span>
            </div>

            {/* Socials as tappable chips rather than bare text */}
            <div className="flex flex-wrap gap-3 pt-1">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-royal-wine bg-cosmic-purple/60 text-sm text-pearl-white/75 hover:border-cyber-pink hover:text-champagne-gold transition-colors" >
                  <s.icon className="w-4 h-4 text-cyber-pink" />
                  {s.name}
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Link columns ── */}
          <div className="grid grid-cols-2 gap-8">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-xs tracking-[0.3em] uppercase text-cyber-pink mb-5">
                  {title}
                </h3>
                <ul className="space-y-0.5">
                  {links.map((l) => (
                    <li key={l.name}>
                      {/* inline-block + vertical padding so each link is a real
                          44px touch target rather than an 18px line of text */}
                      <Link
                        href={l.href}
                        className="inline-block py-3 text-base text-pearl-white/70 hover:text-champagne-gold transition-colors" >
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="py-7 flex flex-col md:flex-row items-center justify-between gap-5">
          <img
            src="/ruas-logo-naac.webp" alt="Ramaiah University of Applied Sciences — NAAC A+ accredited" width={907}
            height={259}
            className="h-9 w-auto object-contain shrink-0" />

          <div className="space-y-1.5 text-center md:text-right order-last md:order-none">
            <p className="text-xs text-pearl-white/45 tracking-wider">
              &copy; 2026 Pravrutti 2.0 &mdash; All rights reserved.
            </p>
            <p className="text-xs text-pearl-white/35 tracking-wider">
              In association with IEEE &amp; ISTE student chapters &middot; Website by{" "}
              <span className="text-champagne-gold/60">Aman Tebriwal &amp; Ganesh S</span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-pearl-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Registrations open soon
          </div>
        </div>
      </div>
    </footer>
  );
}
