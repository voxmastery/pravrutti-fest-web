"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Download, FileText, Calendar as CalendarIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { name: "HOME", href: "/" },
  { name: "ABOUT", href: "/about" },
  { name: "EVENTS", href: "/events" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "FAQ", href: "/faq" },
  { name: "CONTACT", href: "/contact" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => setIsMobileMenuOpen(false), [pathname]);

  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className={`fixed z-50 transition-all duration-500 ${isScrolled ? "top-3 left-3 right-3" : "top-0 left-0 right-0"}`}>
      <nav className={`mx-auto transition-all duration-500 ${
        isScrolled || isMobileMenuOpen
          ? "max-w-[1100px] bg-[#040616]/90 backdrop-blur-xl border border-[#4A1C3A]/60 rounded-2xl shadow-2xl shadow-black/50"
          : "max-w-[1400px] bg-transparent"
      }`}>
        <div className={`flex items-center justify-between px-5 lg:px-7 transition-all ${isScrolled ? "h-14" : "h-20"}`}>
          {/* Logo Section */}
          <div className="flex items-center gap-3.5">
            <a href="https://www.msruas.ac.in" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
              <img
                src="/ruas-logo-white-trans.png"
                alt="RUAS Logo"
                className="h-[22px] md:h-[28px] w-auto object-contain"
              />
            </a>
            <div className="h-5 w-px bg-white/20" />
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src="/pravrutti-logo.png"
                alt="Pravrutti 2.0"
                className="h-[28px] md:h-[35px] w-auto object-contain transition-transform group-hover:scale-105"
                style={{ filter: "drop-shadow(0 0 8px rgba(214, 77, 141, 0.2))" }}
              />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <Link
                key={l.name}
                href={l.href}
                className={`relative font-mono text-[10px] tracking-[0.2em] transition-colors py-1 ${
                  active(l.href) ? "text-[#F2D2AE]" : "text-[#F7EEE4]/50 hover:text-[#F7EEE4]"
                }`}
              >
                {l.name}
                <span className={`absolute -bottom-0.5 left-0 h-px transition-all duration-300 ${
                  active(l.href) ? "w-full bg-[#D64D8D]" : "w-0 group-hover:w-full bg-[#F2D2AE]"
                }`} />
              </Link>
            ))}

            {/* Resources dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="font-mono text-[10px] tracking-[0.2em] text-[#F7EEE4]/50 hover:text-[#F7EEE4] transition-colors flex items-center gap-1 cursor-pointer focus:outline-none">
                RESOURCES <ChevronDown className="w-3 h-3 text-[#D64D8D]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#040616]/95 backdrop-blur-xl border border-[#4A1C3A] text-[#F7EEE4] w-48 p-1 rounded-xl shadow-2xl shadow-black/60">
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <a href="/Pravrutti_Main_Brochure.pdf" download className="flex items-center gap-2 w-full font-mono text-[10px] tracking-wider py-1">
                    <FileText className="w-3.5 h-3.5 text-[#D64D8D]" /> Brochure PDF
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <Link href="/downloads" className="flex items-center gap-2 w-full font-mono text-[10px] tracking-wider py-1">
                    <Download className="w-3.5 h-3.5 text-[#D64D8D]" /> Rulebooks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <Link href="/schedule" className="flex items-center gap-2 w-full font-mono text-[10px] tracking-wider py-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#D64D8D]" /> Schedule
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Link href="/events">
              <Button className="arcade-btn-primary rounded-lg font-mono text-[10px] tracking-[0.15em] px-5 h-9 cursor-pointer">
                ENTER PORTAL
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-[#F2D2AE]" aria-label="Menu">
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div className={`md:hidden fixed inset-0 bg-[#040616]/98 z-40 transition-all duration-500 ${
        isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}>
        <div className="flex flex-col h-full px-8 pt-28 pb-10">
          <div className="flex-1 flex flex-col justify-center gap-5">
            {navLinks.map((l, i) => (
              <Link
                key={l.name}
                href={l.href}
                className={`font-orbitron text-2xl font-black tracking-wider transition-all duration-500 ${
                  active(l.href) ? "text-[#F2D2AE] text-glow-gold" : "text-[#F7EEE4]/70 hover:text-white"
                } ${isMobileMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {l.name}
              </Link>
            ))}

            <div className="mt-4 pt-4 border-t border-[#4A1C3A]/30 space-y-3">
              <span className="font-mono text-[9px] tracking-[0.3em] text-[#D64D8D] uppercase">Resources</span>
              <a href="/Pravrutti_Main_Brochure.pdf" download className="block text-lg text-[#F7EEE4]/50 font-mono hover:text-[#F2D2AE]">Brochure PDF</a>
              <Link href="/downloads" className="block text-lg text-[#F7EEE4]/50 font-mono hover:text-[#F2D2AE]">Rulebooks</Link>
            </div>
          </div>

          <Link href="/events" className="block">
            <Button className="w-full arcade-btn-primary rounded-xl font-orbitron text-sm py-5 h-auto font-black tracking-wider">
              ENTER PORTAL
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
