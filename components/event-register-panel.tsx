"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RegistrationDialog } from "@/components/registration-dialog";
import { Event, eventId, capacityFor, FEST } from "@/lib/pravrutti-data";
import { FEE_PER_HEAD } from "@/lib/applications";
import { Ticket, MapPin, CalendarDays, IndianRupee, Share2, Check } from "lucide-react";

export function EventRegisterPanel({ event }: { event: Event }) {
  const id = eventId(event.name);
  const cap = capacityFor(id);

  const [count, setCount] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/register?event=${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.confirmed?.[id] ?? 0);
        setWaiting(d.pending?.[id] ?? 0);
      })
      .catch(() => setCount(0));
  }, [id]);

  useEffect(load, [load]);

  const taken = count ?? 0;
  const left = Math.max(cap - taken, 0);
  const full = count !== null && left === 0;
  const pct = Math.min((taken / cap) * 100, 100);

  const share = async () => {
    const url = window.location.href;
    const payload = { title: `${event.name} · ${FEST.name}`, text: `Registrations are open for ${event.name}.`, url };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="lg:sticky lg:top-28 p-6 border border-[#4A1C3A] rounded-3xl bg-[#150B1E]/70 backdrop-blur-md cyber-box space-y-5">
        <div className="space-y-3 font-sharetech text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-[#D64D8D] mt-0.5 shrink-0" />
            <div>
              <p className="text-[#F7EEE4] font-bold">{FEST.dates}</p>
              <p className="text-xs text-[#F7EEE4]/45">Applications close 4 October</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#D64D8D] mt-0.5 shrink-0" />
            <p className="text-[#F7EEE4]/80">{FEST.venue}</p>
          </div>
          <div className="flex items-start gap-3">
            <IndianRupee className="w-4 h-4 text-[#D64D8D] mt-0.5 shrink-0" />
            <p className="text-[#F7EEE4]/80">₹{FEE_PER_HEAD} per head · online</p>
          </div>
        </div>

        {/* Capacity meter */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between font-orbitron">
            <span className="text-[10px] uppercase tracking-widest text-[#F7EEE4]/45">Seats confirmed</span>
            <span className="text-xs font-black text-[#F2D2AE]">
              {count === null ? "—" : full ? `${cap} of ${cap}` : `${taken} of ${cap}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#040616] border border-[#4A1C3A] overflow-hidden">
            {count !== null && (
              <div
                className={`h-full animate-meter ${full ? "bg-[#BF8A1B]" : "bg-[#D64D8D]"}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            )}
          </div>
          {waiting > 0 && (
            <p className="text-[10px] font-sharetech text-[#F7EEE4]/45">
              {waiting} {waiting === 1 ? "application" : "applications"} in review
            </p>
          )}
          {!full && count !== null && left <= 15 && (
            <p className="text-[10px] font-sharetech text-[#BF8A1B] animate-seat-blink">
              Filling fast — {left} {left === 1 ? "seat" : "seats"} left to confirm
            </p>
          )}
        </div>

        <Button
          onClick={() => setOpen(true)}
          className="w-full rounded-xl h-12 text-xs font-orbitron font-black uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
        >
          <Ticket className="w-4 h-4 mr-2" />
          {full ? "Apply · join queue" : "Apply to attend"}
        </Button>

        <button
          onClick={share}
          className="w-full flex items-center justify-center gap-2 text-[11px] font-sharetech text-[#F7EEE4]/50 hover:text-[#F2D2AE] transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? "Link copied" : "Share this event"}
        </button>
      </div>

      <RegistrationDialog
        event={open ? event : null}
        onClose={() => setOpen(false)}
        onRegistered={load}
        seatsLeft={left}
      />
    </>
  );
}
