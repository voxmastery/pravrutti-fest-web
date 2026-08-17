"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Download, FileText, Calendar as CalendarIcon, Ticket, LogIn } from "lucide-react";
import { AUTH_LINKS, externalLinkProps } from "@/lib/auth-links";
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
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => setIsMobileMenuOpen(false), [pathname]);

  // Lock the page behind the drawer, and allow Esc to close it.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobileMenuOpen]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled ? "top-3 left-3 right-3" : "top-0 left-0 right-0"
      }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled
            ? "max-w-[1100px] bg-[#0A0818]/90 backdrop-blur-xl border border-[#4A1C3A]/60 rounded-2xl shadow-2xl shadow-black/50"
            : // On phones the bar sits over a photographic hero, so it always needs a
              // scrim to stay legible. Desktop keeps the clean transparent treatment.
              "max-w-[1400px] bg-gradient-to-b from-black/75 to-transparent lg:bg-none lg:from-transparent"
        }`}
      >
        <div
          className={`flex items-center justify-between px-4 sm:px-5 lg:px-7 transition-all ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          {/* Logo Section */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
            <a
              href="https://www.msruas.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-105 shrink-0"
            >
              {/* Official mark including the NAAC A+ accreditation seal. */}
              <img
                src="/ruas-logo-naac.png"
                alt="Ramaiah University of Applied Sciences — NAAC A+ accredited"
                className="h-[26px] md:h-[34px] w-auto object-contain"
                width={907}
                height={259}
              />
            </a>
            <div className="h-5 w-px bg-white/20 shrink-0" />
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="/pravrutti-logo.png"
                alt="Pravrutti 2.0"
                className="h-[30px] md:h-[38px] w-auto object-contain transition-transform group-hover:scale-105"
                style={{ filter: "drop-shadow(0 0 8px rgba(214, 77, 141, 0.25))" }}
              />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-7">
            {navLinks.map((l) => (
              <Link
                key={l.name}
                href={l.href}
                className={`relative font-mono text-xs tracking-[0.18em] transition-colors py-1 ${
                  active(l.href) ? "text-[#F2D2AE]" : "text-[#F7EEE4]/70 hover:text-[#F7EEE4]"
                }`}
              >
                {l.name}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px transition-all duration-300 ${
                    active(l.href) ? "w-full bg-[#D64D8D]" : "w-0 group-hover:w-full bg-[#F2D2AE]"
                  }`}
                />
              </Link>
            ))}

            {/* Resources dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="font-mono text-xs tracking-[0.18em] text-[#F7EEE4]/70 hover:text-[#F7EEE4] transition-colors flex items-center gap-1 cursor-pointer focus:outline-none">
                RESOURCES <ChevronDown className="w-3.5 h-3.5 text-[#D64D8D]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#0A0818]/95 backdrop-blur-xl border border-[#4A1C3A] text-[#F7EEE4] w-52 p-1 rounded-xl shadow-2xl shadow-black/60">
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <a
                    href="/Pravrutti_Main_Brochure.pdf"
                    download
                    className="flex items-center gap-2 w-full font-mono text-xs tracking-wider py-1.5"
                  >
                    <FileText className="w-4 h-4 text-[#D64D8D]" /> Brochure PDF
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <Link href="/downloads" className="flex items-center gap-2 w-full font-mono text-xs tracking-wider py-1.5">
                    <Download className="w-4 h-4 text-[#D64D8D]" /> Rulebooks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <Link href="/schedule" className="flex items-center gap-2 w-full font-mono text-xs tracking-wider py-1.5">
                    <CalendarIcon className="w-4 h-4 text-[#D64D8D]" /> Schedule
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#721F4C]/30 focus:text-[#F2D2AE] rounded-lg cursor-pointer">
                  <Link href="/tickets" className="flex items-center gap-2 w-full font-mono text-xs tracking-wider py-1.5">
                    <Ticket className="w-4 h-4 text-[#D64D8D]" /> My Tickets
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop CTAs — Login sits as a quiet ghost button so REGISTER NOW
              stays the single primary action. Destinations live in lib/auth-links. */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link href={AUTH_LINKS.login} {...externalLinkProps}>
              <Button
                variant="ghost"
                className="rounded-lg font-orbitron text-xs tracking-[0.12em] px-4 h-10 cursor-pointer font-bold text-[#F2D2AE] border border-[#4A1C3A] hover:border-[#D64D8D] hover:bg-[#721F4C]/25 hover:text-[#F7EEE4]"
              >
                <LogIn className="w-4 h-4 mr-1.5" /> LOGIN
              </Button>
            </Link>
            <Link href={AUTH_LINKS.register} {...externalLinkProps}>
              <Button className="arcade-btn-primary rounded-lg font-orbitron text-xs tracking-[0.12em] px-5 h-10 cursor-pointer font-bold">
                REGISTER NOW
              </Button>
            </Link>
          </div>

          {/* Mobile toggle — bordered chip so it reads as a control against the hero photo */}
          <button
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="lg:hidden relative z-[60] flex items-center justify-center w-11 h-11 rounded-xl border border-[#D64D8D]/50 bg-[#150B1E]/80 backdrop-blur-md text-[#F2D2AE] active:scale-95 transition-transform shrink-0"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer.
          Mounted only while open: the previous version kept a full-screen opaque
          panel in the tree at all times and relied purely on an opacity transition
          to hide it, so any hiccup in that transition left an invisible-but-present
          sheet over the page. */}
      {isMobileMenuOpen && (
        <div
          id="mobile-menu"
          className="lg:hidden fixed inset-0 z-40 bg-[#0A0818] overflow-y-auto overscroll-contain"
        >
          {/* Texture so the panel matches the rest of the site */}
          <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-20" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(114,31,76,0.35) 0%, transparent 65%)",
            }}
          />

          <div className="relative flex flex-col min-h-full px-6 pt-24 pb-10">
            <nav className="flex-1 flex flex-col justify-center gap-1.5">
              {navLinks.map((l) => (
                <Link
                  key={l.name}
                  href={l.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`font-orbitron text-2xl font-black tracking-wider py-3 border-b border-[#4A1C3A]/40 transition-colors ${
                    active(l.href) ? "text-[#F2D2AE] text-glow-gold" : "text-[#F7EEE4]/85 active:text-white"
                  }`}
                >
                  {l.name}
                </Link>
              ))}

              <div className="mt-6 pt-5 border-t border-[#4A1C3A]/50 space-y-3">
                <span className="font-mono text-[11px] tracking-[0.3em] text-[#D64D8D] uppercase block">
                  Resources
                </span>
                <a
                  href="/Pravrutti_Main_Brochure.pdf"
                  download
                  className="flex items-center gap-2.5 text-base text-[#F7EEE4]/75 font-mono py-2 active:text-[#F2D2AE]"
                >
                  <FileText className="w-4 h-4 text-[#D64D8D]" /> Brochure PDF
                </a>
                <Link
                  href="/downloads"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 text-base text-[#F7EEE4]/75 font-mono py-2 active:text-[#F2D2AE]"
                >
                  <Download className="w-4 h-4 text-[#D64D8D]" /> Rulebooks
                </Link>
                <Link
                  href="/tickets"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 text-base text-[#F7EEE4]/75 font-mono py-2 active:text-[#F2D2AE]"
                >
                  <Ticket className="w-4 h-4 text-[#D64D8D]" /> My Tickets
                </Link>
              </div>
            </nav>

            <div className="mt-8 space-y-3">
              <Link
                href={AUTH_LINKS.register}
                {...externalLinkProps}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block"
              >
                <Button className="w-full arcade-btn-primary rounded-xl font-orbitron text-base py-6 h-auto font-black tracking-wider">
                  REGISTER NOW
                </Button>
              </Link>
              <Link
                href={AUTH_LINKS.login}
                {...externalLinkProps}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block"
              >
                <Button
                  variant="ghost"
                  className="w-full rounded-xl font-orbitron text-base py-6 h-auto font-black tracking-wider text-[#F2D2AE] border border-[#4A1C3A] hover:border-[#D64D8D] hover:bg-[#721F4C]/25 hover:text-[#F7EEE4]"
                >
                  <LogIn className="w-4 h-4 mr-2" /> LOGIN
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
