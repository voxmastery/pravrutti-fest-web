"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";

type EventTicket = {
  eventId: string;
  eventName: string;
  status: string;
  checkedInAt: string | null;
};

type Result =
  | { kind: "banner"; tone: "ok" | "warn" | "err"; title: string; detail: string }
  /* The gate answers a different question from a desk: not "let them in?" but
     "who is this and what are they here for?" — so it gets cards, not a line. */
  | {
      kind: "person";
      tone: "ok" | "warn";
      name: string;
      college: string | null;
      enteredAt: string;
      alreadyEntered: boolean;
      events: EventTicket[];
    };

/** "Gate" is fest entry; anything else is a specific event's desk. */
const GATE = "__gate__";

export default function ScanPage() {
  const me = useIdentity();
  const dash = useDashboardRole();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  // Read inside the decode callback, which closes over its first render.
  const modeRef = useRef<string | null>(null);
  modeRef.current = mode;

  // Organisers start at the gate; a coordinator running one event has no
  // choice to make, so skip the picker and open straight on their desk.
  useEffect(() => {
    if (!dash.ready || mode !== null) return;
    if (dash.role === "organiser") setMode(GATE);
    else if (dash.role === "coordinator" && dash.events.length === 1)
      setMode(dash.events[0].eventId);
    else if (dash.role === "coordinator") setMode(dash.events[0]?.eventId ?? null);
  }, [dash.ready, dash.role, dash.events, mode]);

  useEffect(() => {
    if (!dash.ready || dash.role === "none" || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let stop: (() => void) | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (res) => {
        if (!res || busy.current) return;
        const active = modeRef.current;
        if (!active) return;
        busy.current = true;

        try {
          if (active === GATE) {
            const r = await fetch("/api/checkin/gate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload: res.getText() }),
            });
            const b = await r.json();
            if (!r.ok) {
              setResult({ kind: "banner", tone: "err", title: "Not recognised", detail: b.error });
            } else {
              setResult({
                kind: "person",
                tone: b.alreadyEntered ? "warn" : "ok",
                name: b.person.name,
                college: b.person.college,
                enteredAt: b.enteredAt,
                alreadyEntered: b.alreadyEntered,
                events: b.events,
              });
              if (!b.alreadyEntered) setCount((c) => c + 1);
            }
          } else {
            const r = await fetch("/api/checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Name the desk's own event: someone may hold up a different
              // event's ticket, and that should read as "not on this list".
              body: JSON.stringify({ payload: res.getText(), eventId: active }),
            });
            const b = await r.json();
            if (!r.ok) {
              setResult({ kind: "banner", tone: "err", title: "Not admitted", detail: b.error });
            } else if (b.alreadyCheckedIn) {
              setResult({
                kind: "banner",
                tone: "warn",
                title: `${b.name} — already checked in`,
                detail: `At ${new Date(b.at).toLocaleTimeString()}${b.by ? ` by ${b.by}` : ""}`,
              });
            } else {
              setResult({ kind: "banner", tone: "ok", title: `${b.name} admitted`, detail: b.eventName });
              setCount((c) => c + 1);
            }
          }
        } catch {
          setResult({ kind: "banner", tone: "err", title: "Network problem", detail: "Try that scan again." });
        }

        // Pause between reads so one ticket cannot fire repeatedly while held
        // in frame, and the operator has time to read the result.
        setTimeout(() => { busy.current = false; }, 2500);
      })
      .then((controls) => { stop = () => controls.stop(); })
      .catch(() => setResult({
        kind: "banner",
        tone: "err",
        title: "Camera unavailable",
        detail: "Allow camera access, then reload.",
      }));

    return () => stop?.();
  }, [dash.ready, dash.role]);

  /* Both dead ends previously rendered a bare sentence with no way out. */
  if (me.ready && !me.signedIn)
    return (
      <main className="min-h-screen grid place-items-center text-white font-ui px-6 text-center gap-4">
        <p>Sign in to scan.</p>
        <Link href="/" className="text-sm text-[#D64D8D] hover:underline">
          Back to Pravrutti
        </Link>
      </main>
    );
  if (dash.ready && dash.role === "none")
    return (
      <main className="min-h-screen grid place-items-center text-white font-ui px-6 text-center gap-4">
        <p>You don&apos;t run any events, so there&apos;s nothing to scan for.</p>
        <Link href="/" className="text-sm text-[#D64D8D] hover:underline">
          Back to Pravrutti
        </Link>
      </main>
    );

  const tone =
    result?.tone === "ok" ? "bg-[#12B76A]" :
    result?.tone === "warn" ? "bg-[#BF8A1B]" :
    result?.tone === "err" ? "bg-[#AC355D]" : "bg-white/10";

  /* Organisers work the gate and nothing else, so they get no picker — all
     24 event pills were noise on a screen that is mostly camera. Coordinators
     get only the events they actually run, and a coordinator with one event
     gets no picker either. The API still lets an organiser admit to any event
     as a backstop; it just isn't a control anyone has to scroll past. */
  const desks =
    dash.role === "organiser"
      ? [{ id: GATE, label: "Gate entry" }]
      : dash.events.map((e) => ({ id: e.eventId, label: e.name }));

  return (
    <main className="min-h-screen bg-[#0A0818] text-white font-ui flex flex-col">
      {/* This page hides the site nav to keep the camera full-bleed, which
          left no way out at all — on a phone, mid-shift, that is a trap.
          Nielsen's "user control and freedom": always give a clearly marked
          exit. 44px tall so it survives a gloved thumb at a busy door. */}
      <div className="p-3 flex items-center justify-between border-b border-white/10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 h-11 pl-1 pr-3 -ml-1 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="font-orbitron font-black">
          {mode === GATE ? "GATE" : "CHECK-IN"}
        </span>
        <span className="text-sm text-white/60 tabular-nums">
          {count} {mode === GATE ? "entered" : "admitted"}
        </span>
      </div>

      {/* Which desk am I? Wrong-desk scans are the likeliest operator error,
          so the answer stays on screen rather than living in a menu. */}
      {desks.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/10">
          {desks.map((d) => (
            <button
              key={d.id}
              onClick={() => { setMode(d.id); setResult(null); }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm border ${
                mode === d.id
                  ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                  : "bg-white/[0.04] text-white/70 border-white/[0.12]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      <video ref={videoRef} className="w-full flex-1 object-cover bg-black" muted playsInline />

      <div className={`${tone} transition-colors`}>
        {!result && <p className="p-5 text-sm text-white/70">Point the camera at a ticket QR.</p>}

        {result?.kind === "banner" && (
          <div className="p-5">
            <p className="font-semibold text-lg leading-snug">{result.title}</p>
            <p className="text-sm opacity-90">{result.detail}</p>
          </div>
        )}

        {result?.kind === "person" && (
          <div className="p-5 max-h-[46vh] overflow-y-auto">
            <p className="font-semibold text-lg leading-snug">{result.name}</p>
            <p className="text-sm opacity-90">
              {result.college ? `${result.college} · ` : ""}
              {result.alreadyEntered
                ? `Already entered at ${new Date(result.enteredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Entered now"}
            </p>

            <div className="mt-3 space-y-2">
              {result.events.length === 0 ? (
                <p className="text-sm opacity-90">No registrations found.</p>
              ) : (
                result.events.map((e) => (
                  <div
                    key={e.eventId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{e.eventName}</span>
                      <span className="block text-xs opacity-75 capitalize">{e.status}</span>
                    </span>
                    <span className="shrink-0 text-xs text-right">
                      {e.checkedInAt ? (
                        <span className="opacity-90">
                          In ·{" "}
                          {new Date(e.checkedInAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : e.status === "confirmed" ? (
                        <span className="opacity-60">Not yet</span>
                      ) : null}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
