"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Ticket, LogIn, LogOut, LayoutDashboard, ScanLine, Users } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole, dashboardLabel } from "@/hooks/use-dashboard-role";
import { isDev, setDevLogin } from "@/lib/dev-identity";
import { isStaffRole, staffCockpitRedirect } from "@/lib/staff-cockpit";
import { SignInModal } from "@/components/sign-in-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { name: "ABOUT", href: "/about" },
  { name: "EVENTS", href: "/events" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "FAQ", href: "/faq" },
  { name: "CONTACT", href: "/contact" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const me = useIdentity();
  const dash = useDashboardRole();
  const staff = dash.ready && isStaffRole(dash.role);
  const homeHref = staff ? "/dashboard" : "/";
  /* Organisers stay in the cockpit. Coordinators still need Events so they
     can open the public page for the event they run (they cannot apply). */
  const shownNav =
    dash.ready && dash.role === "organiser" ? []
      : dash.ready && dash.role === "coordinator" ? navLinks.filter((l) => l.href === "/events")
        : navLinks;

  useEffect(() => {
    if (!dash.ready) return;
    const to = staffCockpitRedirect(pathname, dash.role);
    if (to) router.replace(to);
  }, [dash.ready, dash.role, pathname, router]);

  /* Sign-out has to clear the dev cookie too, or a demo session survives it
     and the button silently does nothing. */
  const signOutAll = () => {
    if (isDev()) setDevLogin(null);
    me.signOut();
  };
  const signedIn = me.signedIn && !!me.email;
  const initials = (me.name || me.email || "?")
    .trim()
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
  /* Phone event pages keep only the Luma back+share bar. Site chrome stays on
     desktop and on every other route, including /events itself. */
  const eventSlugPage = /^\/events\/[^/]+\/?$/.test(pathname);

  return (
    <header
      className={`${eventSlugPage ? "max-lg:hidden" : ""} fixed z-50 transition-all duration-500 ${
        isScrolled ? "top-3 left-3 right-3" : "top-0 left-0 right-0" }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled
            ? "max-w-[1100px] bg-midnight-navy/90 backdrop-blur-xl border border-royal-wine/60 rounded-2xl shadow-2xl shadow-black/50" : // On phones the bar sits over a photographic hero, so it always needs a
              // scrim to stay legible. Desktop keeps the clean transparent treatment.
              "max-w-[1400px] bg-gradient-to-b from-black/75 to-transparent lg:bg-none lg:from-transparent" }`}
      >
        <div
          className={`flex items-center justify-between px-4 sm:px-5 lg:px-7 transition-all ${
            isScrolled ? "h-16" : "h-24" }`}
        >
          {/* Logo Section */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
            {/* A masthead logo is the one link every visitor already knows
                leads home. Staff land on the cockpit instead. */}
            <Link href={homeHref} className="transition-transform hover:scale-105 shrink-0">
              {/* Official mark including the NAAC A+ accreditation seal. */}
              <img
                src="/ruas-logo-naac.webp" alt="Ramaiah University of Applied Sciences — NAAC A+ accredited" className="h-[32px] sm:h-[38px] lg:h-[34px] xl:h-[46px] w-auto object-contain" width={907}
                height={259}
              />
            </Link>
          </div>

          {/* Desktop nav — organisers stay in the cockpit. Coordinators keep
              Events so they can open the public page for the event they run. */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-6">
            {shownNav.map((l) => (
              <Link
                key={l.name}
                href={l.href}
                /* py-3 lifts the hit area from 24px to ~40px. The label is
                   only 12px tall, but Fitts's Law cares about the target, not
                   the glyph. */
                className={`relative text-xs tracking-[0.18em] transition-colors py-3 inline-flex items-center ${
                  active(l.href) ? "text-champagne-gold" : "text-pearl-white/70 hover:text-pearl-white" }`}
              >
                {l.name}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px transition-all duration-300 ${
                    active(l.href) ? "w-full bg-cyber-pink" : "w-0 group-hover:w-full bg-champagne-gold" }`}
                />
              </Link>
            ))}
          </div>

          {/* Desktop CTA — one button, Luma-style: SIGN IN when signed out, an
              account chip once signed in. EVENTS already sits in the nav, so a
              second "register" link here only duplicated it. */}
          <div className="hidden lg:flex items-center gap-2.5">
            {signedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-royal-wine hover:border-cyber-pink hover:bg-neon-purple/25 h-10 pl-1.5 pr-3 cursor-pointer focus:outline-none transition-colors">
                  {me.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={me.image} alt="" className="w-7 h-7 rounded-full shrink-0" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-neon-purple text-champagne-gold font-display text-[10px] font-black flex items-center justify-center shrink-0">
                      {initials}
                    </span>
                  )}
                  <span className="font-display text-xs tracking-[0.12em] font-bold text-champagne-gold max-w-[110px] truncate">
                    {me.name?.split(" ")[0]?.toUpperCase() ?? "ACCOUNT"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-midnight-navy/95 backdrop-blur-xl border border-royal-wine text-pearl-white w-56 p-1 rounded-xl shadow-2xl shadow-black/60">
                  {/* The dashboard had no link anywhere in the UI — a
                      coordinator could sign in and never learn it existed.
                      Shown only once the server has confirmed a role, so it
                      doesn't flash in and then vanish. */}
                  {dash.ready && dash.role !== "none" && (
                    <DropdownMenuItem className="focus:bg-neon-purple/30 focus:text-champagne-gold rounded-lg cursor-pointer">
                      <Link href="/dashboard" className="flex items-center gap-2 w-full text-xs tracking-wider py-1.5">
                        <LayoutDashboard className="w-4 h-4 text-cyber-pink" />
                        {dashboardLabel(dash)}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {dash.ready && dash.faculty && (
                    <DropdownMenuItem className="focus:bg-neon-purple/30 focus:text-champagne-gold rounded-lg cursor-pointer">
                      <Link href="/faculty" className="flex items-center gap-2 w-full text-xs tracking-wider py-1.5">
                        <Users className="w-4 h-4 text-cyber-pink" /> Faculty board
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {staff && (
                    <DropdownMenuItem className="focus:bg-neon-purple/30 focus:text-champagne-gold rounded-lg cursor-pointer">
                      <Link href="/dashboard/scan" className="flex items-center gap-2 w-full text-xs tracking-wider py-1.5">
                        <ScanLine className="w-4 h-4 text-cyber-pink" /> Check-in scanner
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {/* Staff don't get My Tickets: organisers and coordinators
                      run events rather than attend them, and a ticket list
                      that is always empty is worse than no entry at all. */}
                  {dash.ready && dash.role === "none" && (
                    <DropdownMenuItem className="focus:bg-neon-purple/30 focus:text-champagne-gold rounded-lg cursor-pointer">
                      <Link href="/ticket" className="flex items-center gap-2 w-full text-xs tracking-wider py-1.5">
                        <Ticket className="w-4 h-4 text-cyber-pink" /> My Tickets
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={signOutAll}
                    className="focus:bg-neon-purple/30 focus:text-champagne-gold rounded-lg cursor-pointer" >
                    <span className="flex items-center gap-2 w-full text-xs tracking-wider py-1.5">
                      <LogOut className="w-4 h-4 text-cyber-pink" /> Sign out
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setSignInOpen(true)}
                className="arcade-btn-primary rounded-lg font-display text-xs tracking-[0.12em] px-5 h-10 cursor-pointer font-bold" >
                <LogIn className="w-4 h-4 mr-1.5" /> SIGN IN
              </Button>
            )}
          </div>

          {/* Mobile toggle — bordered chip so it reads as a control against the hero photo */}
          <button
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="lg:hidden relative z-[60] flex items-center justify-center w-11 h-11 rounded-xl border border-cyber-pink/50 bg-cosmic-purple/80 backdrop-blur-md text-champagne-gold active:scale-95 transition-transform shrink-0" aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu" >
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
          id="mobile-menu" className="lg:hidden fixed inset-0 z-40 bg-midnight-navy overflow-y-auto overscroll-contain" >
          {/* Texture so the panel matches the rest of the site */}
          <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-20" />
          <div
            className="absolute inset-0 pointer-events-none" style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(114,31,76,0.35) 0%, transparent 65%)",
            }}
          />

          <div className="relative flex flex-col min-h-full px-6 pt-24 pb-10">
            <nav className="flex-1 flex flex-col justify-center gap-1.5">
              {shownNav.map((l) => (
                <Link
                  key={l.name}
                  href={l.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`font-display text-2xl font-black tracking-wider py-3 border-b border-royal-wine/40 transition-colors ${
                    active(l.href) ? "text-champagne-gold text-glow-gold" : "text-pearl-white/85 active:text-white" }`}
                >
                  {l.name}
                </Link>
              ))}
            </nav>

            {/* Mobile CTA — mirrors the desktop single button. */}
            <div className="mt-8 space-y-3">
              {signedIn ? (
                <>
                  <div className="flex items-center gap-3 px-1 pb-1">
                    {me.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={me.image} alt="" className="w-10 h-10 rounded-full shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-neon-purple text-champagne-gold font-display text-sm font-black flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-champagne-gold truncate">{me.name}</p>
                      <p className="text-xs text-pearl-white/50 truncate">{me.email}</p>
                    </div>
                  </div>
                  {/* Desktop reaches these from the account chip menu; mobile
                      has no chip, so they live here. Coordinators run their
                      event from a phone, so this is the likelier surface. */}
                  {dash.ready && dash.role !== "none" && (
                    <Link
                      href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 w-full rounded-xl font-display text-base py-4 font-black tracking-wider text-midnight-navy bg-cyber-pink active:bg-electric-magenta" >
                      <LayoutDashboard className="w-4 h-4" /> {dashboardLabel(dash).toUpperCase()}
                    </Link>
                  )}
                  {dash.ready && dash.faculty && (
                    <Link
                      href="/faculty" onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 w-full rounded-xl font-display text-base py-4 font-black tracking-wider text-champagne-gold border border-royal-wine active:bg-neon-purple/25" >
                      <Users className="w-4 h-4" /> FACULTY BOARD
                    </Link>
                  )}
                  {staff && (
                    <Link
                      href="/dashboard/scan" onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 w-full rounded-xl font-display text-base py-4 font-black tracking-wider text-champagne-gold border border-royal-wine active:bg-neon-purple/25" >
                      <ScanLine className="w-4 h-4" /> CHECK-IN SCANNER
                    </Link>
                  )}
                  {dash.ready && dash.role === "none" && (
                    <Link
                      href="/ticket" onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 w-full rounded-xl font-display text-base py-4 font-black tracking-wider text-champagne-gold border border-royal-wine active:bg-neon-purple/25" >
                      <Ticket className="w-4 h-4" /> MY TICKETS
                    </Link>
                  )}
                  <Button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOutAll();
                    }}
                    variant="ghost" className="w-full rounded-xl font-display text-base py-6 h-auto font-black tracking-wider text-champagne-gold border border-royal-wine hover:border-cyber-pink hover:bg-neon-purple/25 hover:text-pearl-white" >
                    <LogOut className="w-4 h-4 mr-2" /> SIGN OUT
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setSignInOpen(true);
                  }}
                  className="w-full arcade-btn-primary rounded-xl font-display text-base py-6 h-auto font-black tracking-wider" >
                  <LogIn className="w-4 h-4 mr-2" /> SIGN IN
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </header>
  );
}
