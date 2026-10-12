"use client";

/**
 * Registration-desk check-in — slim scanner for volunteers who only admit
 * people. Organisers keep the full /dashboard/scan (gate + team tools).
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Flashlight, LogOut, Search, SwitchCamera, Undo2 } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { isDev, setDevLogin } from "@/lib/dev-identity";
import { FilterGroup } from "@/components/dashboard/filter-group";

type Tone = "ok" | "warn" | "err";

type Hit = {
  eventId: string;
  eventName: string;
  status: string;
  payment?: string;
  checkedInAt: string | null;
  teamName: string | null;
  email: string;
  name: string;
  ticketId?: string;
};

type Result =
  | { kind: "banner"; tone: Tone; title: string; detail: string; retry?: boolean }
  | {
      kind: "desk";
      tone: Tone;
      title: string;
      detail: string;
      name: string;
      eventId: string;
      eventName: string;
      email: string;
      teamName: string | null;
      undoAt?: string;
    };

type Counts = { events: { eventId: string; name: string; checkedIn: number; confirmed: number }[] };

const TIMEOUT_MS = 6000;
type CamControls = { stop: () => void; switchTorch?: (on: boolean) => Promise<void> };

async function postJson(url: string, body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json, timeout: false, network: false };
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === "AbortError";
    return { status: 0, json: {}, timeout, network: !timeout };
  } finally {
    clearTimeout(timer);
  }
}

function toneClass(tone?: Tone) {
  if (tone === "ok") return "bg-success text-midnight-navy";
  if (tone === "warn") return "bg-soft-gold text-midnight-navy";
  return "bg-danger text-midnight-navy";
}

function clock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function paymentLabel(payment?: string, status?: string) {
  if (status === "confirmed") return "Paid / confirmed";
  if (payment === "verified" || payment === "received") return "Payment verified";
  if (payment === "awaiting" || payment === "pending") return "Payment awaiting";
  if (payment === "quoted") return "Payment quoted";
  if (payment) return payment;
  return status || "—";
}

export default function DeskPage() {
  const me = useIdentity();
  const dash = useDashboardRole();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<CamControls | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const busy = useRef(false);
  const modeRef = useRef<string | null>(null);
  const holdRef = useRef(false);
  const lastReq = useRef<{ url: string; body: unknown } | null>(null);

  const [mode, setMode] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [torchNote, setTorchNote] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const allowed =
    dash.ready && (dash.role === "registration" || dash.role === "organiser" || dash.role === "coordinator");

  modeRef.current = mode;
  holdRef.current = searchOpen;

  useEffect(() => {
    if (!dash.ready || mode !== null) return;
    if (dash.events[0]?.eventId) setMode(dash.events[0].eventId);
  }, [dash.ready, dash.events, mode]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/checkin/counts");
        if (!r.ok || stop) return;
        setCounts(await r.json());
      } catch {
        /* Next poll will retry. */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [allowed]);

  function beep(tone: Tone) {
    const ctx = audioRef.current;
    if (ctx) {
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = tone === "ok" ? 880 : tone === "warn" ? 520 : 196;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + (tone === "err" ? 0.28 : 0.12));
      } catch {
        /* optional */
      }
    }
    try {
      navigator.vibrate?.(tone === "ok" ? 40 : tone === "warn" ? [30, 40, 30] : [90, 40, 90]);
    } catch {
      /* optional */
    }
  }

  function startCamera() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC && !audioRef.current) audioRef.current = new AC();
    audioRef.current?.resume?.().catch(() => undefined);
    setCameraOn(true);
  }

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let stop: (() => void) | undefined;
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: facing } },
        videoRef.current,
        (res) => {
          if (!res || busy.current || holdRef.current) return;
          const text = res.getText();
          busy.current = true;
          void handleScan(text).finally(() => {
            setTimeout(() => {
              busy.current = false;
            }, 2000);
          });
        }
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        const cam = controls as CamControls;
        controlsRef.current = cam;
        stop = () => controls.stop();
        if (torchOn && cam.switchTorch) void cam.switchTorch(true);
      })
      .catch(() => {
        setCameraOn(false);
        setResult({
          kind: "banner",
          tone: "err",
          title: "Camera unavailable",
          detail: "Allow camera access, then tap start again.",
        });
      });

    return () => {
      cancelled = true;
      stop?.();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, facing]);

  async function toggleTorch() {
    const cam = controlsRef.current;
    if (!cam?.switchTorch) {
      setTorchNote("Torch isn't available on this camera.");
      return;
    }
    const next = !torchOn;
    try {
      await cam.switchTorch(next);
      setTorchOn(next);
      setTorchNote(null);
    } catch {
      setTorchNote("Torch isn't available on this camera.");
    }
  }

  async function send(url: string, body: unknown, remember = true) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      setResult({
        kind: "banner",
        tone: "err",
        title: "No network",
        detail: "This scan was not saved. Retry when you are back online.",
        retry: true,
      });
      if (remember) lastReq.current = { url, body };
      beep("err");
      return null;
    }
    if (remember) lastReq.current = { url, body };
    const res = await postJson(url, body);
    if (res.timeout || res.network) {
      setResult({
        kind: "banner",
        tone: "err",
        title: res.timeout ? "No response" : "Network problem",
        detail: res.timeout
          ? "The desk did not answer in 6 seconds. Retry — if they were already admitted, it will say so."
          : "Try that scan again.",
        retry: true,
      });
      beep("err");
      return null;
    }
    return res;
  }

  function applyDesk(status: number, b: Record<string, any>, eventId: string) {
    if (b.code === "wrong_event") {
      setResult({
        kind: "banner",
        tone: "err",
        title: "WRONG DESK",
        detail: b.error ?? "This ticket is for another event.",
      });
      beep("err");
      return;
    }
    if (status >= 400 || b.ok === false) {
      const tone: Tone = b.tone === "warn" ? "warn" : "err";
      const title =
        b.code === "cancelled" || b.code === "declined"
          ? "NOT VALID"
          : b.code === "unpaid" || b.code === "in_review"
            ? "NOT CONFIRMED"
            : b.code === "invalid"
              ? "NOT A TICKET"
              : "NOT ADMITTED";
      setResult({ kind: "banner", tone, title, detail: b.error ?? "Not admitted." });
      beep(tone);
      return;
    }
    if (b.alreadyCheckedIn) {
      setResult({
        kind: "desk",
        tone: "warn",
        title: "ALREADY IN",
        detail: `${b.name} · ${clock(b.at)}${b.by ? ` · ${b.by}` : ""}`,
        name: b.name,
        eventId: b.eventId ?? eventId,
        eventName: b.eventName,
        email: b.email,
        teamName: b.teamName ?? null,
      });
      beep("warn");
      return;
    }
    setResult({
      kind: "desk",
      tone: "ok",
      title: "ADMITTED",
      detail: `${b.name} · ${b.eventName}${b.teamName ? ` · ${b.teamName}` : ""}`,
      name: b.name,
      eventId: b.eventId ?? eventId,
      eventName: b.eventName,
      email: b.email,
      teamName: b.teamName ?? null,
      undoAt: b.at,
    });
    beep("ok");
  }

  async function handleScan(text: string) {
    const active = modeRef.current;
    if (!active) return;
    const res = await send("/api/checkin", { payload: text, eventId: active });
    if (!res) return;
    applyDesk(res.status, res.json, active);
  }

  async function checkInRow(eventId: string, email: string) {
    const res = await send("/api/checkin", { eventId, email });
    if (!res) return;
    applyDesk(res.status, res.json, eventId);
    if (res.json?.ok) {
      setHits((rows) =>
        rows.map((h) =>
          h.eventId === eventId && h.email === email
            ? { ...h, checkedInAt: res.json.at ?? new Date().toISOString() }
            : h
        )
      );
    }
  }

  async function undo() {
    if (result?.kind !== "desk" || !result.undoAt) return;
    const res = await send("/api/checkin/undo", { eventId: result.eventId, email: result.email }, false);
    if (!res || res.status >= 400) {
      setResult({ kind: "banner", tone: "err", title: "Undo failed", detail: res?.json?.error ?? "Try again." });
      return;
    }
    setResult({ kind: "banner", tone: "warn", title: "Check-in undone", detail: result.name });
    beep("warn");
  }

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    setSearching(true);
    try {
      const r = await fetch(`/api/checkin/search?q=${encodeURIComponent(query.trim())}`);
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHits([]);
        setResult({ kind: "banner", tone: "err", title: "Search failed", detail: b.error ?? "Try again." });
        return;
      }
      setHits(b.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  const undoLeft = (() => {
    const at = result?.kind === "desk" ? result.undoAt : undefined;
    if (!at) return 0;
    return Math.max(0, 30 - Math.floor((now - Date.parse(at)) / 1000));
  })();

  const overall = (counts?.events ?? []).reduce(
    (acc, e) => ({ checkedIn: acc.checkedIn + e.checkedIn, confirmed: acc.confirmed + e.confirmed }),
    { checkedIn: 0, confirmed: 0 }
  );
  const activeCount = counts?.events.find((e) => e.eventId === mode);
  const desks = dash.events.map((e) => ({ id: e.eventId, label: e.name }));
  const deskName = desks.find((d) => d.id === mode)?.label ?? "Check-in";

  if (me.ready && !me.signedIn) {
    return (
      <main className="min-h-screen grid place-items-center text-white px-6 text-center gap-4 bg-midnight-navy">
        <p>Sign in to use the registration desk.</p>
        <Link href="/" className="text-sm text-cyber-pink hover:underline">
          Back to Pravrutti
        </Link>
      </main>
    );
  }

  if (dash.ready && !allowed) {
    return (
      <main className="min-h-screen grid place-items-center text-white px-6 text-center gap-4 bg-midnight-navy">
        <p>This account isn&apos;t on the registration desk. Ask an organiser to add you.</p>
        <Link href="/" className="text-sm text-cyber-pink hover:underline">
          Back to Pravrutti
        </Link>
      </main>
    );
  }

  const signOut = () => {
    if (isDev()) setDevLogin(null);
    me.signOut();
  };

  return (
    <main className="min-h-screen bg-midnight-navy text-white flex flex-col max-w-lg mx-auto w-full">
      {offline && (
        <p className="bg-danger text-midnight-navy text-center text-sm font-semibold py-2 px-3">
          No network. Scans will not be saved until you are back online.
        </p>
      )}

      <div className="p-3 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-bold tracking-[0.18em] text-champagne-gold/80">REGISTRATION</p>
          <h1 className="font-display font-black text-sm tracking-wide truncate">{deskName}</h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06]"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Live counters — overall + active desk */}
      <div className="px-3 py-2.5 border-b border-white/10 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.06] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-white/45">All events</p>
          <p className="font-display text-lg font-black tabular-nums leading-tight">
            {overall.checkedIn}
            <span className="text-white/40 font-semibold text-sm"> / {overall.confirmed}</span>
          </p>
          <p className="text-[11px] text-white/45">checked in · confirmed</p>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-white/45 truncate">{deskName}</p>
          <p className="font-display text-lg font-black tabular-nums leading-tight" aria-live="polite">
            {activeCount?.checkedIn ?? 0}
            <span className="text-white/40 font-semibold text-sm"> / {activeCount?.confirmed ?? 0}</span>
          </p>
          <p className="text-[11px] text-white/45">checked in · confirmed</p>
        </div>
      </div>

      {desks.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-2.5 border-b border-white/10">
          <FilterGroup
            variant="pill"
            value={mode ?? desks[0].id}
            options={desks}
            onChange={(id) => {
              setMode(id);
              setResult(null);
            }}
            label="Event desk"
            className="flex-nowrap"
            itemClassName="h-10 shrink-0"
          />
        </div>
      )}

      <div className="relative flex-1 min-h-[38vh]">
        <video
          ref={videoRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover bg-black"
          muted
          playsInline
        />
        <Viewfinder tone={result?.tone} />
        {!cameraOn && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <button
              type="button"
              onClick={startCamera}
              className="h-14 px-6 rounded-2xl bg-cyber-pink text-midnight-navy font-display font-black tracking-wider"
            >
              TAP TO START CAMERA
            </button>
          </div>
        )}
        {cameraOn && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
              className="h-11 w-11 grid place-items-center rounded-full bg-black/50 text-pearl-white"
            >
              <Flashlight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setTorchOn(false);
                setFacing((f) => (f === "environment" ? "user" : "environment"));
              }}
              aria-label="Flip camera"
              className="h-11 w-11 grid place-items-center rounded-full bg-black/50 text-pearl-white"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-white/10">
        <div className="flex gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="h-11 px-3 inline-flex items-center gap-2 rounded-lg bg-white/10 text-sm"
          >
            <Search className="w-4 h-4" /> Look up
          </button>
          {torchNote && <p className="self-center text-xs text-champagne-gold">{torchNote}</p>}
        </div>

        {searchOpen && (
          <form onSubmit={runSearch} className="px-3 pb-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ticket ID, name, email, or phone"
                aria-label="Look up a participant"
                className="h-11 flex-1 rounded-lg bg-black/40 px-3 text-sm outline-none ring-1 ring-white/15 focus:ring-cyber-pink"
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-lg bg-cyber-pink text-midnight-navy font-semibold"
                disabled={searching}
              >
                {searching ? "…" : "Find"}
              </button>
            </div>
            <ul className="max-h-56 overflow-y-auto space-y-2">
              {hits.length === 0 && query && !searching && (
                <li className="text-sm text-white/60">No match.</li>
              )}
              {hits.map((h) => (
                <li
                  key={`${h.eventId}:${h.email}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{h.name}</span>
                    <span className="block text-xs text-white/60 truncate">
                      {h.eventName}
                      {h.teamName ? ` · ${h.teamName}` : ""}
                    </span>
                    <span className="block text-[11px] text-white/45 truncate">
                      {paymentLabel(h.payment, h.status)}
                      {h.checkedInAt ? ` · in ${clock(h.checkedInAt)}` : " · not checked in"}
                      {h.ticketId ? ` · ${h.ticketId}` : ""}
                    </span>
                  </span>
                  {h.status === "confirmed" && !h.checkedInAt ? (
                    <button
                      type="button"
                      onClick={() => checkInRow(h.eventId, h.email)}
                      className="h-11 shrink-0 px-3 rounded-lg bg-success text-midnight-navy text-sm font-semibold"
                    >
                      Check in
                    </button>
                  ) : (
                    <span className="text-xs text-white/50 shrink-0 text-right">
                      {h.checkedInAt ? `In ${clock(h.checkedInAt)}` : h.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </form>
        )}

        <div
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className={result ? toneClass(result.tone) : "bg-white/10"}
        >
          {!result && (
            <p className="p-5 text-sm text-white/70">
              {cameraOn
                ? "Point the camera at a ticket QR."
                : "Tap to start the camera, then point it at a ticket QR."}
            </p>
          )}

          {result?.kind === "banner" && (
            <div className="p-5">
              <p className="font-display text-3xl font-black leading-none">{result.title}</p>
              <p className="mt-2 text-sm">{result.detail}</p>
              {result.retry && (
                <button
                  type="button"
                  onClick={() => {
                    const last = lastReq.current;
                    if (!last) return;
                    const payload = (last.body as { payload?: string }).payload;
                    if (payload) {
                      void handleScan(payload);
                      return;
                    }
                    void send(last.url, last.body).then((res) => {
                      if (!res) return;
                      applyDesk(res.status, res.json, (last.body as { eventId?: string }).eventId ?? "");
                    });
                  }}
                  className="mt-3 h-11 px-4 rounded-lg bg-midnight-navy text-pearl-white text-sm font-semibold"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {result?.kind === "desk" && (
            <div className="p-5">
              <p className="font-display text-3xl font-black leading-none">{result.title}</p>
              <p className="mt-2 text-base font-semibold">{result.detail}</p>
              {result.undoAt && undoLeft > 0 && (
                <button
                  type="button"
                  onClick={undo}
                  className="mt-3 h-11 px-4 inline-flex items-center gap-2 rounded-lg bg-midnight-navy text-pearl-white text-sm font-semibold"
                >
                  <Undo2 className="w-4 h-4" /> Undo {undoLeft}s
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compact per-event strip */}
      {counts && counts.events.length > 0 && (
        <div className="border-t border-white/10 px-3 py-2 max-h-28 overflow-y-auto">
          <ul className="space-y-1">
            {counts.events.map((e) => (
              <li key={e.eventId} className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                <span className="truncate">{e.name}</span>
                <span className="tabular-nums shrink-0">
                  {e.checkedIn}/{e.confirmed}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function Viewfinder({ tone }: { tone?: Tone }) {
  const colour =
    tone === "ok"
      ? "border-success"
      : tone === "warn"
        ? "border-soft-gold"
        : tone === "err"
          ? "border-danger"
          : "border-cyber-pink";

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 grid [grid-template-columns:1fr_min(72vw,320px)_1fr] [grid-template-rows:1fr_min(72vw,320px)_1fr]">
        <div className="col-span-3 bg-black/55" />
        <div className="bg-black/55" />
        <div className="relative">
          {[
            "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
            "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
            "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
            "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg",
          ].map((pos) => (
            <span key={pos} className={`absolute w-8 h-8 ${colour} ${pos}`} />
          ))}
        </div>
        <div className="bg-black/55" />
        <div className="col-span-3 bg-black/55" />
      </div>
    </div>
  );
}
