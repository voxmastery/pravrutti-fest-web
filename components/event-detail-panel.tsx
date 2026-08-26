"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RegistrationDialog } from "@/components/registration-dialog";
import { Event, eventId, capacityFor, registrationOpen, FEST } from "@/lib/pravrutti-data";
import { POSTER_TINTS } from "@/lib/poster-tints";
import {
  MapPin,
  Copy,
  Check,
  ArrowUpRight,
  UserCheck,
  Phone,
  User,
  Download,
  IndianRupee,
  ChevronsRight,
} from "lucide-react";

type Going = { first: string; initials: string };

export const COVER_GRADIENTS: Record<Event["category"], string> = {
  "Engineering and Design": "from-[#721F4C] via-[#2B122C] to-[#0A0818]",
  "Research and Presentation": "from-[#BF8A1B] via-[#4A1C3A] to-[#0A0818]",
  "Code and Compute": "from-[#D64D8D] via-[#2B122C] to-[#0A0818]",
  "Enterprise and Expression": "from-[#4A1C3A] via-[#150B1E] to-[#0A0818]",
};

const TYPE_BADGE: Record<Event["type"], string> = {
  Visionary: "bg-[#BF8A1B]/20 text-[#F2D2AE] border-[#BF8A1B]/40",
  Creator: "bg-[#D64D8D]/20 text-[#D64D8D] border-[#D64D8D]/40",
  Explorer: "bg-[#721F4C]/30 text-[#F7EEE4] border-[#721F4C]/50",
};

const PRIZES: Record<Event["type"], { first: string; second: string; third: string }> = {
  Visionary: { first: "₹20,000", second: "₹15,000", third: "₹10,000" },
  Creator: { first: "₹10,000", second: "₹7,000", third: "₹5,000" },
  Explorer: { first: "₹5,000", second: "₹3,000", third: "₹2,000" },
};

export function EventDetailPanel({
  event,
  onClose,
}: {
  event: Event | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Real artwork wins over the generated cover; a missing file falls back.
  const [posterFailed, setPosterFailed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [going, setGoing] = useState<Going[]>([]);

  const id = event ? eventId(event.name) : "";
  const cap = event ? capacityFor(id) : 0;
  const open = registrationOpen();

  const load = useCallback(() => {
    if (!id) return;
    fetch(`/api/register?event=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCount(d.confirmed?.[id] ?? 0);
        setWaiting(d.pending?.[id] ?? 0);
        setGoing(d.going ?? []);
      })
      .catch(() => setCount(null));
  }, [id]);

  useEffect(load, [load]);

  // A different event means a different poster to try again.
  useEffect(() => setPosterFailed(false), [event?.name]);

  // Re-theme the page wash from THIS event's poster, the way Luma derives its
  // background from an event's cover. Category tinting gave eight events one
  // hue; the poster's own dominant colour makes each event distinct. Falls
  // back to the category tint when a poster has no extracted colour.
  useEffect(() => {
    if (!event) return;
    const root = document.documentElement;
    const tint = POSTER_TINTS[eventId(event.name)];

    if (tint) {
      const [r, g, b] = tint;
      const mix = (f: number) => [r, g, b].map((c) => Math.round(c * f)).join(", ");
      root.style.setProperty("--ambient-1", `${r}, ${g}, ${b}`);
      root.style.setProperty("--ambient-2", mix(0.7));
      root.style.setProperty("--ambient-3", mix(0.45));
      root.style.setProperty("--ambient-base", `rgb(${mix(0.16)})`);
    } else {
      root.setAttribute("data-ambient", event.category);
    }

    return () => {
      root.removeAttribute("data-ambient");
      for (const p of ["--ambient-1", "--ambient-2", "--ambient-3", "--ambient-base"]) {
        root.style.removeProperty(p);
      }
    };
  }, [event]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!event) return null;

  const taken = count ?? 0;
  const left = Math.max(cap - taken, 0);
  const full = count !== null && left === 0;
  const prizes = PRIZES[event.type];

  return (
    <>
      <Sheet open={!!event && !registering} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[535px] bg-[#0A0818] border-l-2 border-[#721F4C] text-[#F7EEE4] p-0 overflow-y-auto"
        >
          {/* Header bar — Luma-style: collapse, copy link, full event page */}
          <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-[#0A0818]/90 backdrop-blur-md border-b border-[#4A1C3A]">
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="w-8 h-8 rounded-lg border border-transparent hover:border-[#4A1C3A] hover:bg-[#150B1E] flex items-center justify-center text-[#F7EEE4]/60 hover:text-[#F7EEE4] transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={copyLink}
              className="rounded-lg h-8 border-[#4A1C3A] bg-[#150B1E] text-xs font-bold tracking-wider text-[#F7EEE4]/85 hover:bg-[#2B122C]"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-[#7BE3A8]" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? "COPIED" : "COPY LINK"}
            </Button>
            <Link href={`/events/${id}`} onClick={onClose}>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg h-8 border-[#4A1C3A] bg-[#150B1E] text-xs font-bold tracking-wider text-[#F7EEE4]/85 hover:bg-[#2B122C]"
              >
                EVENT PAGE <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="p-5 sm:p-6 space-y-6 font-orbitron">
            {/* Cover — blurred copy behind it gives Luma's ambient glow */}
            <div className="relative w-full max-w-[400px] mx-auto">
              <div
                aria-hidden
                className={`absolute -inset-4 rounded-3xl bg-gradient-to-br ${COVER_GRADIENTS[event.category]} blur-2xl opacity-50`}
              />
            <div
              className={`relative aspect-square w-full rounded-2xl overflow-hidden border border-[#4A1C3A] bg-gradient-to-br ${COVER_GRADIENTS[event.category]}`}
            >
              {!posterFailed && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={event.poster ?? `/posters/${id}.png`}
                  alt={`Poster for ${event.name}`}
                  onError={() => setPosterFailed(true)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 opacity-20 crt-scanlines pointer-events-none" />
              <div className={`absolute inset-0 flex flex-col justify-between p-6 ${posterFailed ? "" : "hidden"}`}>
                <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-[#F7EEE4]/70">
                  {FEST.name} · {event.category}
                </span>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black text-[#F7EEE4] leading-tight tracking-wide uppercase">
                    {event.name}
                  </h2>
                  <p className="text-xs font-mono tracking-widest uppercase text-[#F2D2AE] mt-2">
                    {event.subCategory}
                  </p>
                </div>
              </div>
            </div>
            </div>

            {/* Title + host */}
            <div className="space-y-2">
              <SheetTitle className="text-2xl sm:text-3xl font-orbitron font-extrabold text-[#F2D2AE] tracking-wide leading-snug">
                {event.name}
              </SheetTitle>
              <p className="text-xs text-[#F7EEE4]/60 font-mono tracking-wider">
                {FEST.name} · Ramaiah University of Applied Sciences
              </p>
              <Badge className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold border ${TYPE_BADGE[event.type]}`} variant="outline">
                {event.type} · {event.fee}
              </Badge>
            </div>

            {/* Date + venue rows — Luma info rows */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl border border-[#4A1C3A] bg-[#150B1E] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[8px] font-mono uppercase text-[#D64D8D] leading-none">OCT</span>
                  <span className="text-base font-black text-[#F7EEE4] leading-tight">15</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F7EEE4]">{FEST.dates}</p>
                  <p className="text-xs text-[#F7EEE4]/55 font-mono">
                    Slot timings on the{" "}
                    <Link href="/schedule" className="underline hover:text-[#D64D8D]" onClick={onClose}>
                      schedule page
                    </Link>
                  </p>
                </div>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.venue ?? FEST.venue)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 group/loc"
              >
                <div className="w-11 h-11 rounded-xl border border-[#4A1C3A] bg-[#150B1E] flex items-center justify-center shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-[#D64D8D]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F7EEE4] group-hover/loc:text-[#F2D2AE] transition-colors flex items-center gap-1">
                    {event.venue ?? FEST.venue}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/loc:opacity-60 transition-opacity" />
                  </p>
                  <p className="text-xs text-[#F7EEE4]/55 font-mono">Offline · At registration desk</p>
                </div>
              </a>
            </div>

            {/* Registration card — Luma-style */}
            <div className="rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/80 overflow-hidden cyber-box">
              <div className="px-4 py-2.5 bg-[#0A0818]/80 border-b border-[#4A1C3A]">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#F7EEE4]/60 font-bold">
                  Registration
                </span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full border border-[#4A1C3A] bg-[#0A0818] flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4 text-[#F2D2AE]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#F7EEE4]">Approval Required</p>
                    <p className="text-xs text-[#F7EEE4]/60 leading-relaxed font-sharetech">
                      Your registration is subject to organiser approval
                      {count !== null && ` — ${left} of ${cap} spots left${waiting > 0 ? `, ${waiting} in queue` : ""}`}.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[#F7EEE4]/80 font-sharetech">
                  Welcome! To join {event.name}, please register below.
                </p>

                {open ? (
                  <Button
                    onClick={() => setRegistering(true)}
                    className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest arcade-btn-magenta border-[#D64D8D] text-white"
                  >
                    {full ? "JOIN WAITLIST" : "REQUEST TO JOIN"}
                  </Button>
                ) : (
                  <Button disabled className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest bg-[#AC355D]/10 text-[#AC355D]/70 border border-[#AC355D]/30">
                    REGISTRATION CLOSED
                  </Button>
                )}

                {going.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex -space-x-2">
                      {going.slice(0, 5).map((g, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full border border-[#721F4C] bg-[#2B122C] flex items-center justify-center text-[9px] font-bold text-[#F2D2AE]"
                        >
                          {g.initials}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-[#F7EEE4]/60 font-mono">
                      {taken} going{going[0] ? ` — ${going[0].first}${going.length > 1 ? ` and ${taken - 1} others` : ""}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-[#D64D8D]">About Event</h4>
              <p className="text-sm text-[#F7EEE4]/85 leading-relaxed font-sharetech">{event.description}</p>
            </div>

            {/* Prizes */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-[#D64D8D]">Prizes</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { place: "1st", amount: prizes.first },
                  { place: "2nd", amount: prizes.second },
                  { place: "3rd", amount: prizes.third },
                ].map((p) => (
                  <div key={p.place} className="p-3 border border-[#4A1C3A] rounded-xl bg-[#150B1E] text-center">
                    <span className="block text-[10px] text-[#F7EEE4]/60 uppercase font-bold">{p.place}</span>
                    <span className="block text-base font-black text-[#F2D2AE] mt-1">{p.amount}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between p-3 border border-[#721F4C] bg-[#2B122C]/40 rounded-xl">
                <span className="flex items-center gap-2 text-xs text-[#F7EEE4]/75 font-bold uppercase tracking-wider">
                  <IndianRupee className="w-4 h-4 text-[#F2D2AE]" /> Entry
                </span>
                <span className={`text-lg font-black ${event.fee.toLowerCase().startsWith("free") ? "text-[#7BE3A8]" : "text-[#F2D2AE]"}`}>
                  {event.fee.toLowerCase().startsWith("free") ? event.fee : `${event.fee} at desk`}
                </span>
              </div>
            </div>

            {/* Location map — Luma embeds one under the event details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-[#D64D8D]">Location</h4>
              <p className="text-sm font-bold text-[#F7EEE4]">{event.venue ?? FEST.venue}</p>
              <p className="text-xs text-[#F7EEE4]/55 font-mono">Offline · At registration desk</p>
              <div className="rounded-2xl overflow-hidden border border-[#4A1C3A] grayscale-[35%] contrast-[1.05]">
                <iframe
                  title={`Map — ${event.venue ?? FEST.venue}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(event.venue ?? FEST.venue)}&z=14&output=embed`}
                  className="w-full h-44 border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            {/* Hosted by */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-[#D64D8D]">Hosted By</h4>
              <div className="space-y-2 font-mono text-xs">
                {[...event.coordinators.faculty, ...event.coordinators.student].map((c) => (
                  <div key={c.name} className="flex justify-between items-center border border-[#4A1C3A] bg-[#150B1E] px-4 py-2.5 rounded-xl">
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#F2D2AE]" /> {c.name}
                    </span>
                    <a href={`tel:${c.phone}`} className="font-bold hover:text-[#D64D8D] flex items-center gap-1.5 text-[#F2D2AE]">
                      <Phone className="w-3 h-3 text-[#D64D8D]" /> {c.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Rulebook */}
            <a href={event.brochureUrl} download={`${event.name}_Rules.pdf`} className="block">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-[#4A1C3A] bg-[#150B1E] text-xs font-bold uppercase tracking-widest text-[#F7EEE4]/85 hover:bg-[#2B122C]"
              >
                <Download className="w-4 h-4 mr-2" /> Download Rulebook
              </Button>
            </a>

            {/* Quiet footer links — Luma-style */}
            <div className="flex items-center gap-5 pt-2 pb-8 border-t border-[#4A1C3A]/60">
              <Link
                href="/contact"
                onClick={onClose}
                className="text-xs font-mono text-[#F7EEE4]/50 hover:text-[#D64D8D] transition-colors pt-3"
              >
                Contact the Host
              </Link>
              <Link
                href="/faq"
                onClick={onClose}
                className="text-xs font-mono text-[#F7EEE4]/50 hover:text-[#D64D8D] transition-colors pt-3"
              >
                FAQs
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <RegistrationDialog
        event={registering ? event : null}
        onClose={() => setRegistering(false)}
        onRegistered={() => {
          load();
        }}
        seatsLeft={left}
      />
    </>
  );
}
