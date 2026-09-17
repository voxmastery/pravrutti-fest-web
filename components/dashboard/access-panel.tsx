"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import type { AccessConfig } from "@/lib/access-control";

/**
 * Where an organiser grants organiser rights and switches coordinator
 * dashboards on or off.
 *
 * Organiser-only, enforced by the API — this component only draws what that
 * API already decided it would show. Addresses in ORGANISER_EMAILS come back
 * marked permanent and are shown without a Remove, because they are the reason
 * a mistake here cannot lock everybody out.
 */

type EventRow = { eventId: string; name: string; coordinators: number };
type Payload = { access: AccessConfig; permanentOrganisers: string[]; events: EventRow[] };

const card = "rounded-xl border border-royal-wine bg-cosmic-purple/40";

export function AccessPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/admin/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  async function act(body: Record<string, unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d?.error ?? "That didn't work. Try again.");
      else {
        setData((prev) => (prev ? { ...prev, access: d.access } : prev));
        setNote(ok);
      }
    } catch {
      setError("Network dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return (
      <div className={`${card} p-5 flex items-center gap-3 text-sm text-pearl-white/50`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading access settings…
      </div>
    );

  const { access, permanentOrganisers, events } = data;
  const disabled = new Set(access.coordinatorsDisabledEventIds);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-black tracking-wide text-champagne-gold">ACCESS</h3>
        <p className="text-[13px] text-pearl-white/50 mt-1 leading-relaxed">
          Organisers can verify payments and read every applicant&apos;s contact details. Grant it
          sparingly.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-strong/40 bg-danger-strong/10 px-3 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}
      {note && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] text-success-soft">
          {note}
        </p>
      )}

      {/* Organisers */}
      <div className={`${card} p-4 space-y-3`}>
        <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-pearl-white/60">
          Organisers
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            aria-label="New organiser email"
            className="flex-1 h-10 rounded-lg border border-transparent bg-white/[0.08] px-3 text-sm text-pearl-white placeholder:text-pearl-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-pink/70"
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() =>
              act({ type: "add_organiser", email }, `${email.trim().toLowerCase()} is now an organiser.`).then(() =>
                setEmail("")
              )
            }
            className="h-10 px-4 rounded-lg bg-cyber-pink text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-electric-magenta disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add
          </button>
        </div>

        <ul className="space-y-1.5">
          {permanentOrganisers.map((e) => (
            <li key={e} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
              <span className="text-[13px] text-pearl-white truncate">{e}</span>
              <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] text-champagne-gold/80">
                <ShieldCheck className="w-3.5 h-3.5" /> Permanent
              </span>
            </li>
          ))}
          {access.organisers.map((g) => (
            <li key={g.email} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-[13px] text-pearl-white truncate">{g.email}</span>
                <span className="block text-[11px] text-pearl-white/40 truncate">
                  added by {g.addedBy || "unknown"}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => act({ type: "remove_organiser", email: g.email }, `${g.email} is no longer an organiser.`)}
                className="shrink-0 rounded-lg p-2 text-pearl-white/40 hover:text-danger hover:bg-danger-strong/10 disabled:opacity-50 cursor-pointer"
                aria-label={`Remove ${g.email}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {permanentOrganisers.length === 0 && access.organisers.length === 0 && (
            <li className="text-[13px] text-pearl-white/40">No organisers listed.</li>
          )}
        </ul>
      </div>

      {/* Coordinator dashboards */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-pearl-white/60">
              Coordinator dashboards
            </p>
            <p className="text-[12px] text-pearl-white/45 mt-0.5">
              {access.coordinatorsEnabled
                ? "On — switch individual events off below."
                : "Off for everyone. Coordinators keep their access but see no roster."}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                { type: "set_coordinators", enabled: !access.coordinatorsEnabled },
                access.coordinatorsEnabled ? "All coordinator dashboards switched off." : "Coordinator dashboards switched on."
              )
            }
            className={`h-10 px-4 rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer ${
              access.coordinatorsEnabled
                ? "border border-royal-wine bg-white/[0.06] text-pearl-white/80 hover:bg-white/[0.12]"
                : "bg-cyber-pink text-white hover:bg-electric-magenta"
            }`}
          >
            {access.coordinatorsEnabled ? "Switch all off" : "Switch all on"}
          </button>
        </div>

        {access.coordinatorsEnabled && (
          <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {events.map((e) => {
              const on = !disabled.has(e.eventId);
              return (
                <li key={e.eventId} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[13px] text-pearl-white truncate">{e.name}</span>
                    <span className="block text-[11px] text-pearl-white/40">
                      {e.coordinators} coordinator{e.coordinators === 1 ? "" : "s"}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(
                        { type: "set_event_coordinator", eventId: e.eventId, enabled: !on },
                        `${e.name}: dashboard ${on ? "off" : "on"}.`
                      )
                    }
                    className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-medium disabled:opacity-50 cursor-pointer ${
                      on
                        ? "bg-success/15 text-success-soft border border-success/40 hover:bg-success/25"
                        : "bg-white/[0.06] text-pearl-white/50 border border-royal-wine hover:bg-white/[0.12]"
                    }`}
                  >
                    {on ? "On" : "Off"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
