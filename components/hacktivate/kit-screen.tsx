"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircuitBoard, ExternalLink, ListOrdered, Wrench } from "lucide-react";
import {
  ARDUINO_IDE_INSTALL_URL,
  ARDUINO_IDE_PCBCUPID_SETUP_URL,
  HACKTIVATE_KIT_CTA,
  HACKTIVATE_KIT_OVERVIEW,
  PCB_CUPID_HACKTIVATE_URL,
} from "@/lib/hacktivate-kit";

type Tab = "overview" | "instructions" | "components";

const TABS: { id: Tab; label: string; icon: typeof CircuitBoard }[] = [
  { id: "overview", label: "Overview", icon: CircuitBoard },
  { id: "instructions", label: "Instructions", icon: Wrench },
  { id: "components", label: "Component List", icon: ListOrdered },
];

export function HacktivateKitScreen() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-24 pt-28 lg:pt-36">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-cyber-pink">
        Hacktivate · PCB Cupid
      </p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-wide sm:text-5xl">
        Inside the event
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-pearl-white/65">
        Kit claim, Arduino setup, and the component counter — hosted with PCB Cupid,
        same flow as Hardware Hackathon 1.0.
      </p>

      <a
        href={PCB_CUPID_HACKTIVATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-cyber-pink/45 bg-cyber-pink/10 px-4 py-3.5 transition-colors hover:border-cyber-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-champagne-gold">{HACKTIVATE_KIT_CTA}</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/50">
            events.pcbcupid.com/events/hacktivate
          </span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-cyber-pink" aria-hidden="true" />
      </a>

      <div
        role="tablist"
        aria-label="Kit sections"
        className="mt-8 flex flex-wrap gap-2"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? "border-success/50 bg-success/15 text-success-soft"
                  : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-6 rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-5 sm:p-6">
        {tab === "overview" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-black text-champagne-gold">Overview</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-pearl-white/80">
              {HACKTIVATE_KIT_OVERVIEW.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyber-pink" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "instructions" && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-black text-champagne-gold">Arduino IDE Setup</h2>
            <ol className="space-y-3">
              <li>
                <a
                  href={ARDUINO_IDE_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-pearl-white transition-colors hover:border-cyber-pink/50"
                >
                  <span>1. Arduino IDE Installation</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-cyber-pink" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={ARDUINO_IDE_PCBCUPID_SETUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-pearl-white transition-colors hover:border-cyber-pink/50"
                >
                  <span>2. Arduino IDE Setup Guide on PCBCUPID</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-cyber-pink" aria-hidden="true" />
                </a>
              </li>
            </ol>
            <p className="text-xs leading-relaxed text-white/45">
              Claim steps, team number at the counter, and return rules are on the PCB Cupid event page.
            </p>
          </div>
        )}

        {tab === "components" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-black text-champagne-gold">Components List</h2>
            <p className="text-sm leading-relaxed text-pearl-white/75">
              Glyph boards, sensors, passives, displays, and the full price / stock table live on
              PCB Cupid so quantities stay current during the build.
            </p>
            <a
              href={`${PCB_CUPID_HACKTIVATE_URL}#components`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-pearl-white px-5 text-xs font-display font-black uppercase tracking-widest text-midnight-navy transition-colors hover:bg-white"
            >
              View full component list
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        <Link href="/events/hacktivate" className="underline underline-offset-2 hover:text-white/70">
          Back to Hacktivate
        </Link>
        {" · "}
        <Link href="/hacktivate/track" className="underline underline-offset-2 hover:text-white/70">
          Track pick
        </Link>
      </p>
    </div>
  );
}
