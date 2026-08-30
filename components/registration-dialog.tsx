"use client";

import { useState, useEffect, useRef } from "react";
import { useIdentity } from "@/lib/identity-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Event, eventId } from "@/lib/pravrutti-data";
import {
  PAYMENTS_LIVE,
  FEE_PER_HEAD,
  MAX_TEAM_SIZE,
  formatFee,
  isValidPhone,
} from "@/lib/applications";
import { MAX_TEAM_BIO, TEAM_CODE_LENGTH, isValidTeamCode, type TeamPreview } from "@/lib/teams";
import { Loader2, ArrowLeft, Pencil, Hourglass, ShieldCheck, RotateCcw, Check, Copy, Users } from "lucide-react";

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
type FormState = Guest;
type TeamPane = "idle" | "create" | "created" | "join" | "verified";
type Result = {
  ticketId: string;
  status: "pending";
  payment: "not_required" | "awaiting" | "paid";
  fee: string;
  eventName: string;
  name: string;
  queuePosition: number;
  capacity: number;
  teamName?: string | null;
  teamCode?: string | null;
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

const card = "rounded-xl border border-white/[0.08] bg-white/[0.05]";
const inputCls =
  "h-[38px] rounded-lg border border-transparent bg-white/[0.08] font-ui text-base md:text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#D64D8D]/70 focus-visible:border-transparent";
const textareaCls =
  "min-h-[76px] rounded-lg border border-transparent bg-white/[0.08] font-ui text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-[#D64D8D]/70 focus-visible:border-transparent";
const labelCls = "block text-sm font-medium text-white/[0.79] mb-1.5";
const primaryBtn =
  "w-full h-[38px] rounded-2xl bg-[#D64D8D] text-white hover:bg-[#c23f7d] font-ui font-medium text-base cursor-pointer";
const ghostBtn =
  "h-[38px] rounded-2xl border border-transparent bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white cursor-pointer";

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  phone: "",
  college: "",
});

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
  const [form, setForm] = useState<FormState>(emptyForm);
  const me = useIdentity();
  const [known, setKnown] = useState<Guest | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [teamPane, setTeamPane] = useState<TeamPane>("idle");
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [teamBioDraft, setTeamBioDraft] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdTeam, setCreatedTeam] = useState<TeamPreview | null>(null);
  const [verifiedTeam, setVerifiedTeam] = useState<TeamPreview | null>(null);
  const [copied, setCopied] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
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

  // Team codes are permanent — restore yours whenever this dialog opens.
  useEffect(() => {
    if (!event || !me.email) return;
    let alive = true;
    const ev = eventId(event.name);
    fetch(`/api/teams?event=${encodeURIComponent(ev)}&mine=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.team?.code) return;
        setCreatedTeam(d.team);
        setTeamPane("created");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event, me.email]);

  const set = (k: keyof Guest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const applicantFee = formatFee(1);
  const teamSize = createdTeam?.memberCount ?? 1;

  const resetTeam = () => {
    setTeamPane("idle");
    setTeamNameDraft("");
    setTeamBioDraft("");
    setJoinCode("");
    setCreatedTeam(null);
    setVerifiedTeam(null);
    setCopied(false);
    setTeamBusy(false);
  };

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setResult(null);
      setError(null);
      setEditing(false);
      setForm(emptyForm());
      resetTeam();
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

  const detailsOk = () => {
    if (form.name.trim().length < 2) {
      fail("Enter the team lead name.");
      return false;
    }
    if (!isValidPhone(form.phone)) {
      fail("Enter a 10-digit phone number.");
      return false;
    }
    if (form.college.trim().length < 2) {
      fail("Enter your college name.");
      return false;
    }
    return true;
  };

  const next = () => {
    if (form.name.trim().length < 2) return fail("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return fail("Enter a valid email address.");
    setError(null);
    setStep(2);
  };

  const finishSuccess = (data: Result) => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ name: form.name, email: form.email, phone: form.phone, college: form.college })
    );
    setResult(data);
    onRegistered();
    fireConfetti();
  };

  const submit = async () => {
    if (!event || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          college: form.college,
          teamName: createdTeam?.name ?? "",
          teamCode: createdTeam?.code ?? "",
          eventId: eventId(event.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data.error ?? "Registration didn't go through. Try again.");
        setSubmitting(false);
        return;
      }
      finishSuccess(data);
    } catch {
      fail("Network dropped. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!event || teamBusy) return;
    if (!detailsOk()) return;
    if (teamNameDraft.trim().length < 2) return fail("Enter a team name.");
    if (teamNameDraft.trim().length > 80) return fail("Team name is too long.");
    if (teamBioDraft.trim().length > MAX_TEAM_BIO) return fail("Team bio is too long.");
    setTeamBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          eventId: eventId(event.name),
          name: teamNameDraft.trim(),
          bio: teamBioDraft.trim(),
          leadName: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          college: form.college.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data.error ?? "Couldn't create the team.");
        return;
      }
      setCreatedTeam(data);
      setTeamPane("created");
    } catch {
      fail("Network dropped. Check your connection and try again.");
    } finally {
      setTeamBusy(false);
    }
  };

  const handleVerifyTeam = async () => {
    if (!event || teamBusy) return;
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!isValidTeamCode(code)) return fail("Enter the team code (6–12 characters).");
    setTeamBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          eventId: eventId(event.name),
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data.error ?? "Couldn't find that team.");
        return;
      }
      setVerifiedTeam(data);
      setJoinCode(data.code ?? code);
      setTeamPane("verified");
    } catch {
      fail("Network dropped. Check your connection and try again.");
    } finally {
      setTeamBusy(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!event || teamBusy || !verifiedTeam) return;
    if (!detailsOk()) return;
    if (verifiedTeam.isFull) return fail(`This team is full (${MAX_TEAM_SIZE} including the lead).`);
    setTeamBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          eventId: eventId(event.name),
          code: verifiedTeam.code,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          college: form.college.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data.error ?? "Couldn't join that team.");
        return;
      }
      finishSuccess(data);
    } catch {
      fail("Network dropped. Check your connection and try again.");
    } finally {
      setTeamBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      fail("Couldn't copy. Select the code and copy it yourself.");
    }
  };

  const signedIn = me.signedIn && !!me.email;
  const mustSignIn = me.authEnabled && !signedIn;
  const oneClick = (signedIn || !!known) && !editing && step === 1;

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
              <DialogHeader className="text-left space-y-0 mb-5">
                <DialogDescription className="font-ui text-[13px] text-white/45 truncate">
                  {event.name} · ₹{FEE_PER_HEAD} per head
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
                  <Field label="Team lead name *">
                    <Input
                      className={inputCls}
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Your full name"
                      autoComplete="name"
                      aria-label="Team lead name"
                    />
                  </Field>
                  <Field label="Phone number *">
                    <Input className={inputCls} type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
                  </Field>
                  <Field label="College or university *">
                    <Input className={inputCls} value={form.college} onChange={set("college")} />
                  </Field>

                  {teamPane === "idle" && (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        onClick={() => { setError(null); setTeamPane("create"); }}
                        className={`${primaryBtn} inline-flex items-center justify-center gap-2`}
                        aria-label="Create team"
                      >
                        <Users className="w-4 h-4" /> Create team
                      </Button>
                      <div className={`${card} p-4 space-y-3`}>
                        <div>
                          <p className="text-sm font-medium text-white">Join team</p>
                          <p className="text-[13px] text-white/45 mt-0.5 leading-relaxed">
                            Have a code from a teammate? Verify the team, then join. Your fee is ₹{FEE_PER_HEAD}.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => { setError(null); setTeamPane("join"); }}
                          className={`${ghostBtn} w-full`}
                          aria-label="Join team"
                        >
                          Join team
                        </Button>
                      </div>
                      <p className="text-[13px] text-white/40 leading-relaxed">
                        Solo is fine — continue without a team. Same ₹{FEE_PER_HEAD} online.
                      </p>
                    </div>
                  )}

                  {teamPane === "create" && (
                    <div className={`${card} p-4 space-y-3`}>
                      <p className="text-sm font-medium text-white">New team</p>
                      <Field label="Team name *">
                        <Input
                          className={inputCls}
                          value={teamNameDraft}
                          onChange={(e) => setTeamNameDraft(e.target.value)}
                          placeholder="e.g. Skyward"
                          maxLength={80}
                          aria-label="Team name"
                        />
                      </Field>
                      <Field label="Team bio">
                        <Textarea
                          className={textareaCls}
                          value={teamBioDraft}
                          onChange={(e) => setTeamBioDraft(e.target.value)}
                          placeholder="A line teammates will recognise"
                          maxLength={MAX_TEAM_BIO}
                          aria-label="Team bio"
                        />
                      </Field>
                      <p className="text-[12px] text-white/40">
                        You’ll get a shareable code. Each person pays ₹{FEE_PER_HEAD} — max {MAX_TEAM_SIZE} including you.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setError(null); setTeamPane("idle"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCreateTeam}
                          disabled={teamBusy}
                          className={`${primaryBtn} flex-1`}
                        >
                          {teamBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {teamPane === "created" && createdTeam && (
                    <div className={`${card} p-4 space-y-3`}>
                      <div>
                        <p className="text-sm font-medium text-white">{createdTeam.name}</p>
                        {createdTeam.bio ? (
                          <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{createdTeam.bio}</p>
                        ) : null}
                      </div>
                      <div className="rounded-lg bg-white/[0.08] px-3 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-white/40">Team code</p>
                          <p className="font-mono text-base sm:text-lg tracking-[0.12em] text-white mt-0.5 break-all">{createdTeam.code}</p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleCopyCode(createdTeam.code)}
                          className={`${ghostBtn} px-3 shrink-0`}
                          aria-label="Copy team code"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <p className="text-[13px] text-white/50 leading-relaxed">
                        Share this code so others can join this event’s team. Joining adds them; each person pays ₹{FEE_PER_HEAD}.
                        Team total so far: ₹{FEE_PER_HEAD * createdTeam.memberCount} ({createdTeam.memberCount}/{MAX_TEAM_SIZE}).
                      </p>
                    </div>
                  )}

                  {teamPane === "join" && (
                    <div className={`${card} p-4 space-y-3`}>
                      <p className="text-sm font-medium text-white">Join a team</p>
                      <Field label="Team code *">
                        <Input
                          className={`${inputCls} font-mono tracking-[0.2em] uppercase`}
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="XXXXXXXXXXXX"
                          maxLength={TEAM_CODE_LENGTH}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-label="Team code"
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setError(null); setJoinCode(""); setTeamPane("idle"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleVerifyTeam}
                          disabled={teamBusy}
                          className={`${primaryBtn} flex-1`}
                        >
                          {teamBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking…</> : "Verify"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {teamPane === "verified" && verifiedTeam && (
                    <div className={`${card} p-4 space-y-3`}>
                      <div>
                        <p className="text-sm font-medium text-white">{verifiedTeam.name}</p>
                        {verifiedTeam.bio ? (
                          <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{verifiedTeam.bio}</p>
                        ) : (
                          <p className="text-[13px] text-white/40 mt-1">No bio for this team.</p>
                        )}
                      </div>
                      <p className="text-[13px] text-white/50">
                        {verifiedTeam.memberCount}/{verifiedTeam.maxMembers} members
                        {verifiedTeam.isFull ? " · full" : ""}
                      </p>
                      <p className="text-[13px] text-white/50 leading-relaxed">
                        Joining adds you to this team for {event.name}. Your application fee is ₹{FEE_PER_HEAD}, paid online.
                        Team total becomes ₹{FEE_PER_HEAD * Math.min(verifiedTeam.memberCount + 1, MAX_TEAM_SIZE)}.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setError(null); setVerifiedTeam(null); setTeamPane("join"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          onClick={handleJoinTeam}
                          disabled={teamBusy || verifiedTeam.isFull}
                          className={`${primaryBtn} flex-1`}
                        >
                          {teamBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining…</> : "Join"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className={`${card} flex items-center justify-between px-4 py-3`}>
                    <div>
                      <p className="text-[13px] text-white/50">Your fee (online)</p>
                      <p className="text-[12px] text-white/35 mt-0.5">
                        ₹{FEE_PER_HEAD} per person
                        {createdTeam
                          ? ` · team total ₹${FEE_PER_HEAD * teamSize}`
                          : verifiedTeam
                          ? ` · team would be ₹${FEE_PER_HEAD * Math.min(verifiedTeam.memberCount + 1, MAX_TEAM_SIZE)}`
                          : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-lg text-white">{applicantFee}</p>
                  </div>

                  {errorBox}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setError(null); setStep(1); }} className={`${ghostBtn} px-4`} aria-label="Back">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    {teamPane !== "join" && teamPane !== "verified" && teamPane !== "create" && (
                      <Button
                        onClick={() => {
                          if (!detailsOk()) return;
                          setError(null);
                          setStep(3);
                        }}
                        className={`${primaryBtn} flex-1`}
                      >
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-step">
                  <div className={`${card} p-4 space-y-3`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-white/50">Entry fee</span>
                      <span className="font-semibold text-lg text-white">{applicantFee}</span>
                    </div>
                    <p className="text-[12px] text-white/40 -mt-1">
                      ₹{FEE_PER_HEAD} for you
                      {createdTeam ? ` · team total ₹${FEE_PER_HEAD * createdTeam.memberCount} (${createdTeam.memberCount}/${MAX_TEAM_SIZE})` : ""}
                    </p>
                    <div className="border-t border-white/[0.08] pt-3 space-y-2 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/45">Team lead</span>
                        <span className="text-white text-right truncate max-w-[60%]">{form.name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/45">Phone</span>
                        <span className="text-white text-right truncate max-w-[60%]">{form.phone}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/45">College</span>
                        <span className="text-white text-right truncate max-w-[60%]">{form.college}</span>
                      </div>
                      {createdTeam ? (
                        <>
                          <div className="flex justify-between gap-3">
                            <span className="text-white/45">Team</span>
                            <span className="text-white text-right truncate max-w-[60%]">{createdTeam.name}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-white/45">Code</span>
                            <span className="text-white font-mono tracking-widest">{createdTeam.code}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between gap-3">
                          <span className="text-white/45">Team</span>
                          <span className="text-white/80">Solo</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-white/[0.08] pt-3 space-y-2.5">
                      {[
                        { icon: Hourglass, text: "Your application joins the queue for this event." },
                        { icon: ShieldCheck, text: "If confirmed, your ticket and QR unlock straight away." },
                        {
                          icon: RotateCcw,
                          text: "If it fills up first, the full fee comes back to you.",
                        },
                      ].map(({ icon: Icon, text }, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                          <Icon className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                          <p className="text-[13px] text-white/65 leading-relaxed">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!PAYMENTS_LIVE && (
                    <p className="text-xs text-amber-200/80 border border-amber-400/20 bg-amber-400/[0.07] rounded-lg px-3 py-2.5 leading-relaxed">
                      Payment is online. Apply now to hold your place in the queue — you’ll get a
                      payment link for {applicantFee} before your application is reviewed.
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
                      ) : !PAYMENTS_LIVE ? (
                        "Submit application"
                      ) : (
                        `Pay ${applicantFee} and apply`
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 py-1 animate-step">
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
                {result.teamName ? (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] text-white/50">Team</span>
                    <span className="text-[13px] font-medium text-white truncate max-w-[55%]">{result.teamName}</span>
                  </div>
                ) : null}
                {result.teamCode ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-[13px] text-white/50">Team code</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(result.teamCode!)}
                      className="inline-flex items-center gap-1.5 text-[13px] font-mono tracking-widest text-white/90 hover:text-white cursor-pointer"
                      aria-label="Copy team code"
                    >
                      {result.teamCode}
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-white/50">Fee</span>
                  <span className="text-[13px] font-medium text-white">{result.fee}</span>
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
                  ? `Pay ${result.fee} online — a payment link will be sent for this application. `
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
