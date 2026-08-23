"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Event, eventId, FEST } from "@/lib/pravrutti-data";
import { PAYMENTS_LIVE } from "@/lib/applications";
import { Ticket, Loader2, IndianRupee, ArrowRight, ArrowLeft, Clock, Pencil, ShieldCheck, Hourglass, RotateCcw } from "lucide-react";

const STORE_KEY = "pravrutti.guest";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

type Guest = { name: string; email: string; phone: string; college: string };
type Result = {
  ticketId: string;
  status: "pending";
  payment: "not_required" | "awaiting" | "paid";
  fee: string;
  eventName: string;
  name: string;
  queuePosition: number;
  capacity: number;
};

function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    return g?.email ? g : null;
  } catch {
    return null;
  }
}

async function fireConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#D64D8D", "#F2D2AE", "#BF8A1B", "#F7EEE4"];
  confetti({ particleCount: 70, spread: 62, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
  setTimeout(() => {
    confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors });
    confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors });
  }, 160);
}

export function RegistrationDialog({
  event,
  onClose,
  onRegistered,
  seatsLeft,
}: {
  event: Event | null;
  onClose: () => void;
  onRegistered: () => void;
  seatsLeft?: number;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<Guest & { teamName: string; members: string }>({
    name: "",
    email: "",
    phone: "",
    college: "",
    teamName: "",
    members: "",
  });
  const me = useIdentity();
  const [known, setKnown] = useState<Guest | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!event) return;
    const g = loadGuest();
    if (g) {
      setKnown(g);
      setForm((f) => ({ ...f, ...g }));
    }
    // A verified identity always wins over anything cached locally.
    if (me.email) {
      setForm((f) => ({ ...f, name: f.name || me.name || "", email: me.email! }));
    }
  }, [event, me.email, me.name]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setResult(null);
      setError(null);
      setEditing(false);
      setForm({ name: "", email: "", phone: "", college: "", teamName: "", members: "" });
    }, 200);
  };

  const fail = (msg: string) => {
    setError(msg);
    requestAnimationFrame(() => {
      const el = errRef.current;
      if (!el) return;
      el.classList.remove("animate-shake");
      void el.offsetWidth;
      el.classList.add("animate-shake");
    });
  };

  const next = () => {
    if (form.name.trim().length < 2) return fail("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return fail("Enter a valid email address.");
    setError(null);
    setStep(2);
  };

  const submit = async () => {
    if (!event || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, eventId: eventId(event.name) }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data.error ?? "Registration didn't go through. Try again.");
        setSubmitting(false);
        return;
      }
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ name: form.name, email: form.email, phone: form.phone, college: form.college })
      );
      setResult(data);
      onRegistered();
      fireConfetti();
    } catch {
      fail("Network dropped. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "bg-[#040616] border-[#4A1C3A] rounded-xl h-11 text-[#F7EEE4] placeholder:text-[#F7EEE4]/30 font-sharetech focus-visible:ring-[#D64D8D] focus-visible:border-[#D64D8D]";
  const signedIn = me.signedIn && !!me.email;
  const mustSignIn = me.authEnabled && !signedIn;
  const oneClick = (signedIn || !!known) && !editing && step === 1;
  const isFree = event?.fee.toLowerCase() === "free";

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && close()}>
      {event && (
        <DialogContent className="bg-[#0A0512] border-[#4A1C3A] text-[#F7EEE4] rounded-3xl max-w-md max-h-[92vh] overflow-y-auto cyber-box p-6">
          {!result ? (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="font-orbitron tracking-wider text-[#F2D2AE] font-black uppercase text-lg leading-tight">
                  {event.name}
                </DialogTitle>
                <DialogDescription className="font-sharetech text-[#F7EEE4]/60 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-[#D64D8D]" />
                    {event.fee === "Free" ? "Free entry" : event.fee}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#D64D8D]" /> {FEST.dates}
                  </span>
                  {typeof seatsLeft === "number" && seatsLeft <= 0 && (
                    <span className="text-[#BF8A1B] font-bold">Queue is past capacity</span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 pt-1 pb-3">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      step >= n ? "bg-[#D64D8D]" : "bg-[#4A1C3A]"
                    }`}
                  />
                ))}
                <span className="text-[10px] font-orbitron tracking-widest text-[#F7EEE4]/40 pl-1">{step}/3</span>
              </div>

              {step === 1 ? (
                <div className="space-y-3 animate-step">
                  {mustSignIn ? (
                    <div className="p-5 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/70 text-center space-y-4">
                      <p className="font-sharetech text-xs text-[#F7EEE4]/70 leading-relaxed">
                        Sign in so your ticket stays tied to your inbox — you can reopen it on any device.
                      </p>
                      <Button
                        onClick={me.signIn}
                        className="w-full rounded-xl h-11 bg-[#F7EEE4] hover:bg-white text-[#0A0512] text-xs font-orbitron font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-2.5"
                      >
                        <GoogleMark /> Continue with Google
                      </Button>
                    </div>
                  ) : oneClick ? (
                    <div className="p-4 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/70 flex items-center gap-3">
                      {signedIn && me.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={me.image} alt="" className="w-10 h-10 rounded-xl shrink-0" />
                      ) : (
                        <span className="w-10 h-10 shrink-0 rounded-xl bg-[#721F4C] text-[#F2D2AE] font-orbitron font-black flex items-center justify-center text-sm">
                          {(form.name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{form.name}</p>
                        <p className="text-xs text-[#F7EEE4]/50 font-sharetech truncate">{form.email}</p>
                      </div>
                      {signedIn ? (
                        <span className="text-[9px] font-orbitron uppercase tracking-widest text-[#D64D8D] px-2 py-1 rounded-full border border-[#D64D8D]/40 shrink-0">
                          Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => setEditing(true)}
                          className="text-[#D64D8D] hover:text-[#F2D2AE] p-2 cursor-pointer"
                          aria-label="Use different details"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Input className={inputCls} placeholder="Full name" value={form.name} onChange={set("name")} />
                      <Input
                        className={inputCls}
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={set("email")}
                        disabled={signedIn}
                      />
                    </>
                  )}

                  {error && (
                    <p ref={errRef} className="text-xs font-sharetech text-[#D64D8D] border border-[#D64D8D]/40 bg-[#D64D8D]/10 rounded-xl p-3">
                      {error}
                    </p>
                  )}

                  {!mustSignIn && (
                    <>
                      <Button
                        onClick={next}
                        className="w-full rounded-xl h-11 text-xs font-orbitron font-bold uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
                      >
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <p className="text-[10px] text-center text-[#F7EEE4]/35 font-sharetech">
                        {signedIn ? "Two quick details and you're done." : "Name and email are all we need to hold your spot."}
                      </p>
                    </>
                  )}
                </div>
              ) : step === 2 ? (
                <div className="space-y-3 animate-step">
                  <Input className={inputCls} placeholder="Phone number" type="tel" value={form.phone} onChange={set("phone")} />
                  <Input className={inputCls} placeholder="College or university" value={form.college} onChange={set("college")} />
                  <Input className={inputCls} placeholder="Team name (skip if solo)" value={form.teamName} onChange={set("teamName")} />
                  <Textarea
                    className={inputCls + " min-h-[68px] h-auto py-3"}
                    placeholder="Teammates, comma separated (optional)"
                    value={form.members}
                    onChange={set("members")}
                  />

                  {error && (
                    <p ref={errRef} className="text-xs font-sharetech text-[#D64D8D] border border-[#D64D8D]/40 bg-[#D64D8D]/10 rounded-xl p-3">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setStep(1); }}
                      className="rounded-xl h-11 border-[#4A1C3A] text-[#F7EEE4]/70 hover:bg-[#150B1E] cursor-pointer px-4"
                      aria-label="Back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        if (!/^\+?\d{10,13}$/.test(form.phone.replace(/[^\d+]/g, "")))
                          return fail("Enter a 10-digit phone number.");
                        if (form.college.trim().length < 2) return fail("Enter your college name.");
                        setError(null);
                        setStep(3);
                      }}
                      className="flex-1 rounded-xl h-11 text-xs font-orbitron font-bold uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-step">
                  {/* Step 3 — the deal, stated plainly before they commit */}
                  <div className="p-4 rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/70 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-sharetech text-xs uppercase tracking-widest text-[#F7EEE4]/45">
                        {isFree ? "Entry" : "Entry fee"}
                      </span>
                      <span className="font-orbitron font-black text-xl text-[#F2D2AE]">
                        {isFree ? "Free" : event.fee}
                      </span>
                    </div>
                    <div className="border-t border-[#4A1C3A] pt-3 space-y-2.5">
                      {[
                        { icon: Hourglass, text: "Your application joins the queue for this event." },
                        { icon: ShieldCheck, text: "If confirmed, your ticket and QR unlock straight away." },
                        {
                          icon: RotateCcw,
                          text: isFree
                            ? "If the event fills up first, we'll tell you and free your slot."
                            : "If it fills up first, the full fee comes back to you.",
                        },
                      ].map(({ icon: Icon, text }, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                          <Icon className="w-3.5 h-3.5 text-[#D64D8D] mt-0.5 shrink-0" />
                          <p className="font-sharetech text-xs text-[#F7EEE4]/70 leading-relaxed">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isFree && !PAYMENTS_LIVE && (
                    <p className="text-[11px] font-sharetech text-[#F2D2AE]/80 border border-[#BF8A1B]/35 bg-[#BF8A1B]/10 rounded-xl p-3 leading-relaxed">
                      Online payment opens shortly. Apply now to hold your place in the queue — the team
                      will send you a payment link before your application is reviewed.
                    </p>
                  )}

                  {error && (
                    <p ref={errRef} className="text-xs font-sharetech text-[#D64D8D] border border-[#D64D8D]/40 bg-[#D64D8D]/10 rounded-xl p-3">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setError(null); setStep(2); }}
                      className="rounded-xl h-11 border-[#4A1C3A] text-[#F7EEE4]/70 hover:bg-[#150B1E] cursor-pointer px-4"
                      aria-label="Back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={submit}
                      disabled={submitting}
                      className="flex-1 rounded-xl h-11 text-xs font-orbitron font-bold uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting</>
                      ) : isFree || !PAYMENTS_LIVE ? (
                        <><Ticket className="w-4 h-4 mr-2" /> Submit application</>
                      ) : (
                        <><IndianRupee className="w-4 h-4 mr-1" /> Pay {event.fee} and apply</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5 py-1">
              <DialogHeader>
                <DialogTitle className="font-orbitron tracking-wider text-[#F7EEE4] font-black uppercase text-center text-xl">
                  Application in
                </DialogTitle>
                <DialogDescription className="font-sharetech text-[#F7EEE4]/55 text-center">
                  {result.eventName}
                </DialogDescription>
              </DialogHeader>

              <div className="prize-ticket animate-ticket rounded-2xl px-5 pt-5 pb-4 text-[#0A0512]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-orbitron text-[9px] font-black uppercase tracking-[0.2em] text-[#721F4C]">
                      {FEST.name}
                    </p>
                    <p className="font-orbitron font-black text-base leading-tight truncate mt-0.5">
                      {result.eventName}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#BF8A1B]/20 border border-[#BF8A1B]/50 font-orbitron text-[9px] font-black uppercase tracking-widest text-[#8a6212]">
                    In review
                  </span>
                </div>

                <div className="my-4 text-center">
                  <p className="font-sharetech text-[10px] uppercase tracking-widest text-[#721F4C]">
                    Queue position
                  </p>
                  <p className="font-orbitron font-black text-5xl text-[#AC355D] leading-none mt-1">
                    #{result.queuePosition}
                  </p>
                  <p className="font-sharetech text-[11px] text-[#0A0512]/55 mt-1.5">
                    {result.capacity} seats to be confirmed
                  </p>
                </div>

                <div className="prize-ticket-perf pt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sharetech text-[9px] uppercase tracking-widest text-[#721F4C]">Applicant</p>
                    <p className="font-orbitron font-black text-sm truncate">{result.name}</p>
                  </div>
                  <p className="font-orbitron font-black text-base tracking-wider text-[#AC355D] shrink-0">
                    {result.ticketId}
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-sharetech text-xs text-[#F7EEE4]/60 leading-relaxed">
                <p>
                  {result.payment === "not_required"
                    ? "Nothing to pay for this one."
                    : result.payment === "awaiting"
                    ? `The team will send a payment link for ${result.fee} before reviewing your application.`
                    : `${result.fee} received. Refunded in full if you aren't confirmed.`}
                </p>
                <p>
                  Track it any time at{" "}
                  <a href="/ticket" className="text-[#F2D2AE] underline hover:text-[#D64D8D]">
                    the ticket page
                  </a>{" "}
                  with this email.
                </p>
              </div>

              <div className="flex gap-2">
                <a href="/ticket" className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-11 border-[#4A1C3A] text-[#F2D2AE] hover:bg-[#150B1E] text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Track status
                  </Button>
                </a>
                <Button
                  onClick={close}
                  className="flex-1 rounded-xl h-11 text-xs font-orbitron font-bold uppercase tracking-widest text-white arcade-btn-magenta border-[#D64D8D] cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
