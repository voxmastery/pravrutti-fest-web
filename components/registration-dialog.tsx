"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Event, eventId, FEST } from "@/lib/pravrutti-data";
import { PAYMENTS_LIVE } from "@/lib/applications";
import { COVER_GRADIENTS } from "@/components/event-detail-panel";
import { Loader2, ArrowLeft, Pencil, Hourglass, ShieldCheck, RotateCcw, Check } from "lucide-react";

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

/* Luma's apply form is not a boxed popup: it's a full-screen dimmed
   overlay with the form floating frameless on it — labels above filled
   borderless inputs, one accent-colored submit. */
/* Values measured off luma.com's own apply form:
   inputs 38px tall / 8px radius / white-8% fill / transparent border,
   labels 14px 500 at 79% white with 6px gap, CTA 38px tall at 16px radius. */
const card = "rounded-xl border border-white/[0.08] bg-white/[0.05]";
const inputCls =
  "h-[38px] rounded-lg border border-transparent bg-white/[0.08] font-ui text-base md:text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#D64D8D]/70 focus-visible:border-transparent";
const labelCls = "block text-sm font-medium text-white/[0.79] mb-1.5";
const primaryBtn =
  "w-full h-[38px] rounded-2xl bg-[#D64D8D] text-white hover:bg-[#c23f7d] font-ui font-medium text-base cursor-pointer";
const ghostBtn =
  "h-[38px] rounded-2xl border border-transparent bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
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

  const signedIn = me.signedIn && !!me.email;
  const mustSignIn = me.authEnabled && !signedIn;
  const oneClick = (signedIn || !!known) && !editing && step === 1;
  const isFree = event?.fee.toLowerCase() === "free";

  const stepLabel = step === 1 ? "Your Info" : step === 2 ? "A Few Details" : "Review & Submit";

  const errorBox = error && (
    <p ref={errRef} className="font-ui text-[13px] text-[#ff7aa8] border border-[#D64D8D]/30 bg-[#D64D8D]/10 rounded-lg px-3 py-2.5">
      {error}
    </p>
  );

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && close()}>
      {event && (
        <DialogContent
          aria-describedby={undefined}
          className="fixed inset-0 left-0 top-0 z-50 block h-full w-full max-w-none sm:max-w-none gap-0 translate-x-0 translate-y-0 rounded-none border-0 bg-[#0c0812]/[0.97] backdrop-blur-2xl text-white p-0 font-ui overflow-y-auto data-[state=open]:slide-in-from-bottom-4"
        >
          <div className="mx-auto w-full max-w-[400px] px-5 pt-[9vh] pb-16">
          {!result ? (
            <>
              {/* Luma-style: frameless heading, event named in a muted kicker */}
              <DialogHeader className="text-left space-y-0 mb-5">
                <DialogDescription className="font-ui text-[13px] text-white/45 truncate">
                  {event.name} · {event.fee === "Free" ? "Free entry" : event.fee}
                  {typeof seatsLeft === "number" && seatsLeft <= 0 && " · waitlist"}
                </DialogDescription>
                <div className="flex items-center justify-between pt-1">
                  <DialogTitle className="font-ui font-semibold text-[22px] text-white">
                    {stepLabel}
                  </DialogTitle>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          step === n ? "w-4 bg-white" : step > n ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </DialogHeader>

              {step === 1 ? (
                <div className="space-y-3 animate-step">
                  {mustSignIn ? (
                    <div className={`${card} p-5 text-center space-y-4`}>
                      <p className="text-[13px] text-white/60 leading-relaxed">
                        Sign in so your ticket stays tied to your inbox — you can reopen it on any device.
                      </p>
                      <Button onClick={me.signIn} className={`${primaryBtn} inline-flex items-center gap-2.5`}>
                        <GoogleMark /> Continue with Google
                      </Button>
                    </div>
                  ) : oneClick ? (
                    <div className={`${card} p-3.5 flex items-center gap-3`}>
                      {signedIn && me.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={me.image} alt="" className="w-10 h-10 rounded-full shrink-0" />
                      ) : (
                        <span className="w-10 h-10 shrink-0 rounded-full bg-white/10 text-white/90 font-medium flex items-center justify-center text-sm">
                          {(form.name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{form.name}</p>
                        <p className="text-[13px] text-white/45 truncate">{form.email}</p>
                      </div>
                      {signedIn ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300/90 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full shrink-0">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => setEditing(true)}
                          className="text-white/40 hover:text-white p-2 cursor-pointer"
                          aria-label="Use different details"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Field label="Full name *">
                        <Input className={inputCls} value={form.name} onChange={set("name")} />
                      </Field>
                      <Field label="Email *">
                        <Input className={inputCls} type="email" value={form.email} onChange={set("email")} disabled={signedIn} />
                      </Field>
                    </>
                  )}

                  {errorBox}

                  {!mustSignIn && (
                    <>
                      <Button onClick={next} className={primaryBtn}>
                        Continue
                      </Button>
                      <p className="text-xs text-center text-white/35">
                        {signedIn ? "Two quick details and you're done." : "Name and email are all we need to hold your spot."}
                      </p>
                    </>
                  )}
                </div>
              ) : step === 2 ? (
                <div className="space-y-4 animate-step">
                  <Field label="Phone number *">
                    <Input className={inputCls} type="tel" value={form.phone} onChange={set("phone")} />
                  </Field>
                  <Field label="College or university *">
                    <Input className={inputCls} value={form.college} onChange={set("college")} />
                  </Field>
                  <Field label="Team name (skip if solo)">
                    <Input className={inputCls} value={form.teamName} onChange={set("teamName")} />
                  </Field>
                  <Field label="Teammates, comma separated">
                    <Textarea className={inputCls + " min-h-[80px] h-auto py-3"} value={form.members} onChange={set("members")} />
                  </Field>

                  {errorBox}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setError(null); setStep(1); }} className={`${ghostBtn} px-4`} aria-label="Back">
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
                      className={`${primaryBtn} flex-1`}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-step">
                  {/* Review — the deal, stated plainly before they commit */}
                  <div className={`${card} p-4 space-y-3`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-white/50">{isFree ? "Entry" : "Entry fee"}</span>
                      <span className="font-semibold text-lg text-white">{isFree ? "Free" : event.fee}</span>
                    </div>
                    <div className="border-t border-white/[0.08] pt-3 space-y-2.5">
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
                          <Icon className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                          <p className="text-[13px] text-white/65 leading-relaxed">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isFree && !PAYMENTS_LIVE && (
                    <p className="text-xs text-amber-200/80 border border-amber-400/20 bg-amber-400/[0.07] rounded-lg px-3 py-2.5 leading-relaxed">
                      Online payment opens shortly. Apply now to hold your place in the queue — the team
                      will send you a payment link before your application is reviewed.
                    </p>
                  )}

                  {errorBox}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setError(null); setStep(2); }} className={`${ghostBtn} px-4`} aria-label="Back">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Button onClick={submit} disabled={submitting} className={`${primaryBtn} flex-1`}>
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                      ) : isFree || !PAYMENTS_LIVE ? (
                        "Submit application"
                      ) : (
                        `Pay ${event.fee} and apply`
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 py-1 animate-step">
              {/* Pending state — Luma's calm confirmation, our queue mechanics */}
              <div className="flex flex-col items-center text-center pt-2 space-y-3">
                <span className="w-12 h-12 rounded-full bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
                  <Hourglass className="w-5 h-5 text-emerald-300" />
                </span>
                <div>
                  <DialogTitle className="font-ui font-semibold text-lg text-white">
                    Application submitted
                  </DialogTitle>
                  <DialogDescription className="font-ui text-[13px] text-white/50 mt-0.5">
                    {result.eventName}
                  </DialogDescription>
                </div>
              </div>

              <div className={`${card} divide-y divide-white/[0.08]`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-white/50">Status</span>
                  <span className="text-[13px] font-medium text-amber-200/90">Pending approval</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-white/50">Queue position</span>
                  <span className="text-[13px] font-semibold text-white">#{result.queuePosition} of {result.capacity}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-white/50">Applicant</span>
                  <span className="text-[13px] font-medium text-white truncate max-w-[55%]">{result.name}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-white/50">Reference</span>
                  <span className="text-[13px] font-mono text-white/80">{result.ticketId}</span>
                </div>
              </div>

              <p className="text-[13px] text-white/55 leading-relaxed text-center px-2">
                {result.payment === "not_required"
                  ? "Nothing to pay for this one. "
                  : result.payment === "awaiting"
                  ? `The team will send a payment link for ${result.fee} before reviewing your application. `
                  : `${result.fee} received — refunded in full if you aren't confirmed. `}
                You'll get your ticket and QR once the organisers approve.
              </p>

              <div className="flex gap-2">
                <a href="/ticket" className="flex-1">
                  <Button variant="outline" className={`${ghostBtn} w-full`}>
                    Track status
                  </Button>
                </a>
                <Button onClick={close} className={`${primaryBtn} flex-1`}>
                  Done
                </Button>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
