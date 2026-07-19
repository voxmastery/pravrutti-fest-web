"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useScrollReveal } from "@/hooks/use-animations";

const footerLinks = {
  Navigate: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Events", href: "/events" },
    { name: "Schedule", href: "/schedule" },
  ],
  Resources: [
    { name: "Main Brochure", href: "/Pravrutti_Main_Brochure.pdf" },
    { name: "Rulebooks", href: "/downloads" },
  ],
  Support: [
    { name: "FAQs", href: "/faq" },
    { name: "Contact Us", href: "/contact" },
  ],
};

const socialLinks = [
  { name: "Instagram", href: "https://www.instagram.com/pravrutti_ruas" },
  { name: "University", href: "https://www.msruas.ac.in" },
];

export function FooterSection() {
  const ref = useScrollReveal();

  return (
    <footer className="relative bg-[#040616] border-t border-[#4A1C3A]/40">
      {/* Glow line at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-[#D64D8D]/40 to-transparent" />

      <div ref={ref} className="reveal-up max-w-[1200px] mx-auto px-6">
        {/* Main grid */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 space-y-5">
            <Link href="/" className="inline-block">
              <img
                src="/pravrutti-logo.png"
                alt="Pravrutti 2.0"
                className="h-12 w-auto object-contain"
                style={{ filter: "drop-shadow(0 0 10px rgba(214, 77, 141, 0.2))" }}
              />
            </Link>
            <p className="text-xs text-[#F7EEE4]/40 leading-relaxed max-w-xs font-mono">
              The flagship national-level tech symposium of Ramaiah University of Applied Sciences.
            </p>
            <div className="flex gap-5">
              {socialLinks.map((l) => (
                <a
                  key={l.name}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[#F7EEE4]/40 hover:text-[#F2D2AE] transition-colors flex items-center gap-1 group"
                >
                  {l.name}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#D64D8D]" />
                </a>
              ))}
              <a
                href="mailto:pravrutti@msruas.ac.in"
                className="text-xs font-mono text-[#F7EEE4]/40 hover:text-[#F2D2AE] transition-colors flex items-center gap-1 group"
              >
                Email
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#D64D8D]" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#D64D8D] mb-5">{title}</h3>
              <ul className="space-y-3">
                {links.map((l) => (
                  <li key={l.name}>
                    <Link href={l.href} className="text-xs font-mono text-[#F7EEE4]/40 hover:text-[#F2D2AE] transition-colors">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-[#4A1C3A]/30 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-[10px] font-mono text-[#F7EEE4]/25 tracking-wider">
              &copy; 2026 PRAVRUTTI 2.0 &mdash; All rights reserved.
            </p>
            <p className="text-[9px] font-mono text-[#F7EEE4]/15 tracking-wider">
              In association with IEEE &amp; ISTE student chapters. Website by <span className="text-[#F2D2AE]/40">Aman Tebriwal</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#F7EEE4]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D64D8D] animate-pulse" />
            Portal Operational
          </div>
        </div>
      </div>
    </footer>
  );
}
