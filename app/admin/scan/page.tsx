"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useIdentity } from "@/lib/identity-context";

type Result =
  | { tone: "ok"; title: string; detail: string }
  | { tone: "warn"; title: string; detail: string }
  | { tone: "err"; title: string; detail: string };

export default function ScanPage() {
  const me = useIdentity();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!me.signedIn) return;
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then((d) => setAllowed(d.role === "organiser"))
      .catch(() => setAllowed(false));
  }, [me.signedIn]);

  useEffect(() => {
    if (allowed !== true || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let stop: (() => void) | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (res) => {
        if (!res || busy.current) return;
        busy.current = true;
        try {
          const r = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: res.getText() }),
          });
          const body = await r.json();
          if (!r.ok) {
            setResult({ tone: "err", title: "Not admitted", detail: body.error });
          } else if (body.alreadyCheckedIn) {
            setResult({
              tone: "warn",
              title: `${body.name} — already checked in`,
              detail: `At ${new Date(body.at).toLocaleTimeString()}${body.by ? ` by ${body.by}` : ""}`,
            });
          } else {
            setResult({ tone: "ok", title: `${body.name} admitted`, detail: body.eventName });
            setCount((c) => c + 1);
          }
        } catch {
          setResult({ tone: "err", title: "Network problem", detail: "Try that scan again." });
        }
        // Pause between reads so one ticket cannot fire repeatedly while held
        // in frame, and the operator has time to read the banner.
        setTimeout(() => { busy.current = false; }, 2500);
      })
      .then((controls) => { stop = () => controls.stop(); })
      .catch(() => setResult({
        tone: "err",
        title: "Camera unavailable",
        detail: "Allow camera access, then reload.",
      }));

    return () => stop?.();
  }, [allowed]);

  if (me.ready && !me.signedIn)
    return <main className="min-h-screen grid place-items-center text-white font-ui">Sign in to scan.</main>;
  if (allowed === false)
    return <main className="min-h-screen grid place-items-center text-white font-ui">Organisers only.</main>;

  const tone =
    result?.tone === "ok" ? "bg-[#12B76A]" :
    result?.tone === "warn" ? "bg-[#BF8A1B]" :
    result?.tone === "err" ? "bg-[#AC355D]" : "bg-white/10";

  return (
    <main className="min-h-screen bg-[#0A0818] text-white font-ui flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <span className="font-orbitron font-black">CHECK-IN</span>
        <span className="text-sm text-white/60">{count} admitted</span>
      </div>

      <video ref={videoRef} className="w-full flex-1 object-cover bg-black" muted playsInline />

      <div className={`p-5 ${tone} transition-colors`}>
        {result ? (
          <>
            <p className="font-semibold text-lg leading-snug">{result.title}</p>
            <p className="text-sm opacity-90">{result.detail}</p>
          </>
        ) : (
          <p className="text-sm text-white/70">Point the camera at a ticket QR.</p>
        )}
      </div>
    </main>
  );
}
