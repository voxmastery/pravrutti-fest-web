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
  PHONE_HINT,
  PHONE_INPUT_MAX,
  formatFee,
  isValidPhone,
  isValidPaymentRef,
  PAYMENT_REF_HINT,
  phoneFieldValue,
} from "@/lib/applications";
import { MAX_TEAM_BIO, TEAM_CODE_LENGTH, isValidTeamCode, type TeamPreview } from "@/lib/teams";
import { Loader2, ArrowLeft, Pencil, Hourglass, ShieldCheck, RotateCcw, Check, Copy, Users } from "lucide-react";
import { PALETTE } from "@/lib/palette";
import { JUNO_PAYMENT_URL } from "@/lib/juno";
import { ApplicationReviewCard } from "@/components/application-review-card";
import { TeamRosterPanel } from "@/components/team-roster-panel";

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
type FormState = Guest & { paymentRef: string; junoRegId: string };
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
  hasPaymentRef?: boolean;
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
  const colors = [PALETTE.cyberPink, PALETTE.champagneGold, PALETTE.softGold, PALETTE.pearlWhite];
  confetti({ particleCount: 70, spread: 62, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
  setTimeout(() => {
    confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors });
    confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors });
  }, 160);
}

const card = "rounded-xl border border-white/[0.08] bg-white/[0.05]";
const inputCls =
  "h-[38px] rounded-lg border border-transparent bg-white/[0.08] text-base md:text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-cyber-pink/70 focus-visible:border-transparent";
const textareaCls =
  "min-h-[76px] rounded-lg border border-transparent bg-white/[0.08] text-base text-white placeholder:text-white/25 focus-visible:ring-1 focus-visible:ring-cyber-pink/70 focus-visible:border-transparent";
const labelCls = "block text-sm font-medium text-white/[0.79] mb-1.5";
const primaryBtn =
  "w-full h-[38px] rounded-2xl bg-cyber-pink text-white hover:bg-electric-magenta font-medium text-base cursor-pointer";
const ghostBtn =
  "h-[38px] rounded-2xl border border-transparent bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white cursor-pointer";

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  phone: "",
  college: "",
  paymentRef: "",
  junoRegId: "",
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
  /* The payment step is two screens: confirm-and-pay, then come back and quote
     the reference. Splitting them keeps the second screen about one thing. */
  const [payPhase, setPayPhase] = useState<"confirm" | "reference">("confirm");
  const [startingPayment, setStartingPayment] = useState(false);
  /* The college's portal has served a 404 to the same URL that worked minutes
     later, and students hit it mid-payment. Checked before sending anyone. */
  const [portalDown, setPortalDown] = useState(false);
  /* Teams this person already has for other events, so we can offer the name
     instead of making them retype it. */
  const [otherTeams, setOtherTeams] = useState<{ eventId: string; eventName: string; name: string; isLead: boolean }[]>([]);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  /* Submitting is the point of no return for the money: the ₹200 is already
     with the college, so this asks once before filing it. */
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!event) return;
    const g = loadGuest();
    if (g) {
      setKnown(g);
      // Cached entries predate the digits-only rule, so a stored "+91 98765
      // 43210" is re-normalised rather than shown back in a shape the field
      // itself no longer accepts.
      setForm((f) => ({ ...f, ...g, phone: phoneFieldValue(g.phone) }));
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

    fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "others", eventId: ev, email: me.email }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.teams)) setOtherTeams(d.teams);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event, me.email]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, phone: phoneFieldValue(e.target.value) }));

  const applicantFee = formatFee(1);
  const teamCap = createdTeam?.maxMembers ?? verifiedTeam?.maxMembers ?? event?.teamSize.max ?? MAX_TEAM_SIZE;
  const joining = teamPane === "join" || teamPane === "verified";
  /* 21 of 24 events are team-only. Both the copy and the Continue gate read
     from the event itself so a new event needs no code change here. */
  const soloAllowed = event?.teamSize.soloAllowed ?? true;
  const teamRangeLabel = !event
    ? "a team"
    : event.teamSize.min === event.teamSize.max
    ? `${event.teamSize.min} people`
    : `${event.teamSize.min}\u2013${event.teamSize.max} people`;
  const hasTeam = Boolean(createdTeam) || joining;
  /* What to put in the portal's "number of participants". The portal fixes this
     at payment and it cannot be raised once teammates join later, so the max
     team size is the only safe answer — the fee is per team regardless. */
  const portalParticipants = event?.teamSize.max ?? 1;
  // Only nag once they have typed something — an empty field is not yet a mistake.
  const phoneDirtyInvalid = form.phone.length > 0 && !isValidPhone(form.phone);

  const resetTeam = () => {
    setTeamPane("idle");
    setTeamNameDraft("");
    setTeamBioDraft("");
    setJoinCode("");
    setCreatedTeam(null);
    setVerifiedTeam(null);
    setCopied(false);
    setTeamBusy(false);
    setConfirmDeleteTeam(false);
  };

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setResult(null);
      setError(null);
      setEditing(false);
      setForm(emptyForm());
      setPayPhase("confirm");
      setConfirmCancel(false);
      setConfirmSubmit(false);
      resetTeam();
    }, 200);
  };

  const handleDeleteTeam = async () => {
    if (!event || !createdTeam || teamBusy) return;
    setTeamBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          eventId: eventId(event.name),
          code: createdTeam.code,
          email: form.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTeamBusy(false);
        return fail(data?.error ?? "Couldn't delete the team. Try again.");
      }
      resetTeam();
    } catch {
      setTeamBusy(false);
      fail("Network dropped. Check your connection and try again.");
    }
  };

  /* Cancelling at the payment screen: nothing has been submitted yet, so this
     simply puts them back at the start to try again — the case it exists for is
     a payment that failed on the portal. */
  const restartRegistration = () => {
    setConfirmCancel(false);
    setConfirmSubmit(false);
    setPayPhase("confirm");
    setForm((f) => ({ ...f, paymentRef: "", junoRegId: "" }));
    setError(null);
    setStep(1);
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
      fail(PHONE_HINT);
      return false;
    }
    if (form.college.trim().length < 2) {
      fail("Enter your college name.");
      return false;
    }
    // Payment details live on step 3, so they are not gated here — and neither
    // is required: Path B auto-verifies from the Juno registration ID, and an
    // application with neither reference simply waits for manual verification.
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

  /* Recorded before they leave, not after they come back.

     Payment happens on the college's portal in another tab and we get no
     callback from it, so a registration written only on their return is lost
     to anything that interrupts them — the portal failing mid-payment, a
     closed tab, a lost receipt. The person then has no record here while their
     money has already moved, which is how twenty-two teams were lost. The row
     goes in first; the reference fills it in afterwards. */
  const goToPortal = async (force: boolean) => {
    if (!event || startingPayment) return;
    setError(null);
    setStartingPayment(true);

    if (!force) {
      const health = await fetch("/api/payment-portal", { cache: "no-store" })
        .then((r) => r.json())
        /* A failed check says nothing about the portal, so it is not treated
           as bad news — it just lets them through. */
        .catch(() => ({ ok: true }));
      if (!health?.ok) {
        setPortalDown(true);
        setStartingPayment(false);
        return;
      }
    }

    try {
      await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "intent",
          name: form.name,
          email: form.email,
          phone: form.phone,
          college: form.college,
          teamName: createdTeam?.name ?? "",
          teamCode: createdTeam?.code ?? "",
          eventId: eventId(event.name),
        }),
      });
    } catch {
      /* Best effort. Failing to record the attempt must not stop anyone
         paying; it only costs us the safety net. */
    }

    setStartingPayment(false);
    setPortalDown(false);
    window.open(JUNO_PAYMENT_URL, "_blank", "noopener,noreferrer");
    setPayPhase("reference");
  };

  const submit = async (opts?: { refUnavailable?: boolean }) => {
    if (!event || submitting) return;
    const refUnavailable = opts?.refUnavailable === true;
    // Charged applicants must quote a plausible receipt reference; joiners are
    // covered by their lead and are never asked for one.
    /* Somebody who paid and cannot reach their reference is registered
       anyway. Refusing them does not bring the money back — it only hides
       them from the desk, which is the failure we are actually fixing. */
    if (!joining && !refUnavailable && !isValidPaymentRef(form.paymentRef)) {
      setConfirmSubmit(false);
      return fail(PAYMENT_REF_HINT);
    }
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
          paymentRef: refUnavailable ? "" : form.paymentRef,
          refUnavailable,
          junoRegId: form.junoRegId,
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
    if (verifiedTeam.isFull) return fail(`This team is full (${verifiedTeam.maxMembers} including the lead).`);
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
    <p ref={errRef} className="text-[13px] text-cyber-pink-light border border-cyber-pink/30 bg-cyber-pink/10 rounded-lg px-3 py-2.5">
      {error}
    </p>
  );

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && close()}>
      {event && (
        <DialogContent
          aria-describedby={undefined}
          className="fixed inset-0 left-0 top-0 z-50 block h-full w-full max-w-none sm:max-w-none gap-0 translate-x-0 translate-y-0 rounded-none border-0 bg-midnight-navy/[0.97] backdrop-blur-2xl text-white p-0 overflow-y-auto data-[state=open]:slide-in-from-bottom-4" >
          <div className="mx-auto w-full max-w-[400px] px-5 pt-[9vh] pb-16">
          {!result ? (
            <>
              <DialogHeader className="text-left space-y-0 mb-5">
                <DialogDescription className="text-[13px] text-white/45 truncate">
                  {event.name} · {joining ? "no payment" : `₹${FEE_PER_HEAD} per team`}
                  {typeof seatsLeft === "number" && seatsLeft <= 0 && " · waitlist"}
                </DialogDescription>
                <div className="flex items-center justify-between pt-1">
                  <DialogTitle className="font-semibold text-[22px] text-white">
                    {stepLabel}
                  </DialogTitle>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          step === n ? "w-4 bg-white" : step > n ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20" }`}
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
                        <span className="flex items-center gap-1 text-[11px] font-medium text-success-soft/90 bg-success/10 border border-success/20 px-2 py-1 rounded-full shrink-0">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => setEditing(true)}
                          className="text-white/40 hover:text-white p-2 cursor-pointer" aria-label="Use different details" >
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
                      placeholder="Your full name" autoComplete="name" aria-label="Team lead name" />
                  </Field>
                  <Field label="Phone number *">
                    <Input
                      className={inputCls}
                      type="tel" inputMode="numeric" maxLength={PHONE_INPUT_MAX}
                      value={form.phone}
                      onChange={setPhone}
                      placeholder="10-digit mobile number" autoComplete="tel" aria-label="Phone number" aria-invalid={phoneDirtyInvalid || undefined}
                      aria-describedby={phoneDirtyInvalid ? "phone-hint" : undefined}
                    />
                    {phoneDirtyInvalid && (
                      <p id="phone-hint" className="mt-1.5 text-[12px] text-cyber-pink-light">
                        {PHONE_HINT}
                      </p>
                    )}
                  </Field>
                  <Field label="College or university *">
                    <Input className={inputCls} value={form.college} onChange={set("college")} />
                  </Field>

                  {teamPane === "idle" && (
                    <div className="space-y-3">

                      {/* They already have a team elsewhere — offer the name
                          rather than making them retype it. Only the name
                          travels; teammates join this event with the new code. */}
                      {otherTeams.length > 0 && (
                        <div className="rounded-xl border border-soft-gold/20 bg-soft-gold/[0.05] p-3.5 space-y-2.5">
                          <p className="text-[13px] text-white/75 leading-relaxed">
                            You’re on <span className="text-white font-medium">{otherTeams[0].name}</span> for{" "}
                            {otherTeams[0].eventName}. Use the same team name here?
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setTeamNameDraft(otherTeams[0].name);
                                setTeamPane("create");
                              }}
                              className={`${primaryBtn} flex-1`}>
                              Continue with {otherTeams[0].name}
                            </Button>
                          </div>
                          <p className="text-[11px] text-white/40 leading-relaxed">
                            A team is per event, so this makes a new team with a new code — your
                            teammates join with that code. Or create/join a different team below.
                          </p>
                        </div>
                      )}
                      <Button
                        type="button" onClick={() => { setError(null); setTeamPane("create"); }}
                        className={`${primaryBtn} inline-flex items-center justify-center gap-2`}
                        aria-label="Create team" >
                        <Users className="w-4 h-4" /> Create team
                      </Button>
                      <div className={`${card} p-4 space-y-3`}>
                        <div>
                          <p className="text-sm font-medium text-white">Join team</p>
                          <p className="text-[13px] text-white/45 mt-0.5 leading-relaxed">
                            Have a code from a teammate? Verify the team, then join. You don&apos;t pay — the lead covers the team fee.
                          </p>
                        </div>
                        <Button
                          type="button" onClick={() => { setError(null); setTeamPane("join"); }}
                          className={`${ghostBtn} w-full`}
                          aria-label="Join team" >
                          Join team
                        </Button>
                      </div>
                      {/* Most events are team-only; offering "solo is fine"
                          there sends people into a 400 from the server. */}
                      {soloAllowed ? (
                        <p className="text-[13px] text-white/40 leading-relaxed">
                          Solo is fine — continue without a team. ₹{FEE_PER_HEAD} online, same as a team lead.
                        </p>
                      ) : (
                        <p className="text-[13px] text-champagne-gold/80 leading-relaxed">
                          {event.name} is a team event — you need {teamRangeLabel} to enter. Create a team or
                          join one with a code.
                        </p>
                      )}
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
                          placeholder="e.g. Skyward" maxLength={80}
                          aria-label="Team name" />
                      </Field>
                      <Field label="Team bio">
                        <Textarea
                          className={textareaCls}
                          value={teamBioDraft}
                          onChange={(e) => setTeamBioDraft(e.target.value)}
                          placeholder="A line teammates will recognise" maxLength={MAX_TEAM_BIO}
                          aria-label="Team bio" />
                      </Field>
                      <p className="text-[12px] text-white/40">
                        You&apos;ll get a shareable code. You pay ₹{FEE_PER_HEAD} for the team — teammates who join with the code do not. Max {teamCap} including you. The code stays valid after you submit.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button" variant="outline" onClick={() => { setError(null); setTeamPane("idle"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button" onClick={handleCreateTeam}
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
                          <p className="text-base sm:text-lg tracking-[0.12em] text-white mt-0.5 break-all">{createdTeam.code}</p>
                        </div>
                        <Button
                          type="button" onClick={() => handleCopyCode(createdTeam.code)}
                          className={`${ghostBtn} px-3 shrink-0`}
                          aria-label="Copy team code" >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <p className="text-[13px] text-white/50 leading-relaxed">
                        Add your teammates below and we’ll email each of them an invite. The code
                        still works if someone would rather join with it. You pay ₹{FEE_PER_HEAD}
                        {" "}for the team; they do not.
                      </p>

                      {/* The roster, and the button that grows it. Adding holds a
                          place at once, so the lead never waits on acceptances. */}
                      <TeamRosterPanel
                        eventId={eventId(event.name)}
                        team={createdTeam}
                        leadEmail={form.email}
                        leadName={form.name}
                        leadCollege={form.college}
                        onTeam={setCreatedTeam}
                        cardCls={card}
                        inputCls={inputCls}
                        ghostBtn={ghostBtn}
                        primaryBtn={primaryBtn}
                      />

                      {/* Dissolving the team is the lead's call and is allowed at
                          any time; teammates keep their own applications and
                          simply stop belonging to a team. */}
                      {confirmDeleteTeam ? (
                        <div className="rounded-lg border border-danger-strong/30 bg-danger-strong/[0.07] p-3 space-y-2.5">
                          <p className="text-[13px] text-white/80 leading-relaxed">
                            Delete {createdTeam.name}? The code stops working for everyone and anyone
                            who joined is no longer on a team. You can create another after.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button" variant="outline"
                              onClick={() => setConfirmDeleteTeam(false)}
                              className={`${ghostBtn} flex-1`}>
                              Keep team
                            </Button>
                            <Button
                              type="button" onClick={handleDeleteTeam} disabled={teamBusy}
                              className="flex-1 h-[38px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium cursor-pointer">
                              {teamBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete team"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setError(null); setConfirmDeleteTeam(true); }}
                          className="text-xs text-danger hover:text-danger-strong underline underline-offset-2 cursor-pointer">
                          Delete this team
                        </button>
                      )}
                    </div>
                  )}

                  {teamPane === "join" && (
                    <div className={`${card} p-4 space-y-3`}>
                      <p className="text-sm font-medium text-white">Join a team</p>
                      <Field label="Team code *">
                        <Input
                          className={`${inputCls} tracking-[0.2em] uppercase`}
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="XXXXXXXXXXXX" maxLength={TEAM_CODE_LENGTH}
                          autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                          aria-label="Team code" />
                      </Field>
                      <div className="flex gap-2">
                        <Button
                          type="button" variant="outline" onClick={() => { setError(null); setJoinCode(""); setTeamPane("idle"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button" onClick={handleVerifyTeam}
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
                        Joining adds you to this team for {event.name}. The team lead covers the fee — you don&apos;t pay.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button" variant="outline" onClick={() => { setError(null); setVerifiedTeam(null); setTeamPane("join"); }}
                          className={`${ghostBtn} px-4`}
                        >
                          Back
                        </Button>
                        <Button
                          type="button" onClick={handleJoinTeam}
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
                      <p className="text-[13px] text-white/50">{joining ? "Your fee" : "Your fee (online)"}</p>
                      <p className="text-[12px] text-white/35 mt-0.5">
                        {joining
                          ? "The team lead covers the team fee." : createdTeam
                          ? `₹${FEE_PER_HEAD} for the team · paid by you as lead` : `₹${FEE_PER_HEAD} per team · paid by the lead`}
                      </p>
                    </div>
                    <p className="font-semibold text-lg text-white">{joining ? "—" : applicantFee}</p>
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
                          // Team-only event: the server refuses a solo entry,
                          // so stop here rather than sending them to the
                          // payment step and failing after they have paid.
                          if (!soloAllowed && !hasTeam)
                            return fail(
                              `${event.name} is a team event — create a team or join one with a code before continuing.`
                            );
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
                  {/* The summary belongs to the confirm screen; the reference
                      screen is deliberately about one thing. */}
                  {payPhase === "confirm" && (
                  <div className={`${card} p-4 space-y-3`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-white/50">Entry fee</span>
                      <span className="font-semibold text-lg text-white">{applicantFee}</span>
                    </div>
                    <p className="text-[12px] text-white/40 -mt-1">
                      ₹{FEE_PER_HEAD} for the team
                      {createdTeam ? ` · you pay as lead (${createdTeam.memberCount}/${createdTeam.maxMembers || teamCap})` : ""}
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
                            <span className="text-white tracking-widest">{createdTeam.code}</span>
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
                  )}

                  {payPhase === "confirm" ? (
                    <>
                      {/* The portal cannot be prefilled (lib/juno.ts explains why),
                          so the only thing worth saying here is the one value
                          people get wrong: the participant count is fixed at
                          payment and cannot be raised once teammates join. */}
                      <div className="rounded-xl border border-soft-gold/20 bg-soft-gold/[0.05] p-3.5 space-y-1.5">
                        <p className="text-[13px] text-white/75 leading-relaxed">
                          The portal asks for your name, mobile, email and{" "}
                          <span className="text-white font-medium">number of participants</span>.
                        </p>
                        <p className="text-[13px] text-white/60 leading-relaxed">
                          Enter{" "}
                          <span className="text-champagne-gold font-semibold">{portalParticipants}</span>{" "}
                          for the participant count — that is the most {event.name} allows, and it cannot
                          be raised later, so it leaves room for teammates to join. The fee is{" "}
                          {applicantFee} for the team either way.
                        </p>
                      </div>

                      {errorBox}

                      {/* Better to say the portal is down than to open a tab
                          that shows Not Found and leave them wondering whether
                          they have been charged. Advisory, not a gate: the
                          check runs from our server and can be wrong about
                          what their phone sees. */}
                      {portalDown && (
                        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2.5 space-y-2">
                          <p className="text-[12px] text-white/75 leading-relaxed">
                            The college&apos;s payment portal isn&apos;t responding right now. It
                            usually comes back within a few minutes — nothing has been charged, and
                            your details here are saved.
                          </p>
                          <button
                            type="button"
                            onClick={() => goToPortal(true)}
                            className="text-xs text-white/55 hover:text-white underline underline-offset-2 cursor-pointer"
                          >
                            Open it anyway
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setError(null); setStep(2); }} className={`${ghostBtn} px-4`} aria-label="Back">
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => goToPortal(false)}
                          disabled={startingPayment}
                          className={`${primaryBtn} flex-1`}
                        >
                          {startingPayment ? "Checking the portal…" : "Proceed to payment"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Back from the portal. One reference is enough — asking for
                          a second number they also have to find helps nobody. */}
                      <div className={`${card} p-4 space-y-3`}>
                        <div>
                          <p className="text-sm font-medium text-white">Paid? Enter your transaction ID</p>
                          <p className="text-[13px] text-white/45 mt-0.5 leading-relaxed">
                            It is on your Juno receipt. We check it against the portal&apos;s statement —
                            your ticket and QR are emailed once it clears.
                          </p>
                        </div>
                        <Field label="Juno transaction ID">
                          <Input
                            className={inputCls}
                            value={form.paymentRef}
                            onChange={set("paymentRef")}
                            placeholder="From your Juno payment receipt" maxLength={80}
                            aria-label="Juno transaction ID" />
                        </Field>
                        <button
                          type="button"
                          onClick={() => window.open(JUNO_PAYMENT_URL, "_blank", "noopener,noreferrer")}
                          className="text-xs text-white/45 hover:text-white/80 underline underline-offset-2 cursor-pointer"
                        >
                          Reopen the payment portal
                        </button>
                        {/* The portal can fail after taking the money, which
                            leaves somebody paid and with no reference to show
                            for it. Refusing their registration does not bring
                            the money back — it only keeps them off the desk
                            list. They go through, and an organiser matches
                            them against the college's sheet. */}
                        <button
                          type="button"
                          onClick={() => submit({ refUnavailable: true })}
                          disabled={submitting}
                          className="block text-xs text-white/45 hover:text-white/80 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                        >
                          I paid but can&apos;t find my transaction ID
                        </button>
                      </div>

                      {errorBox}

                      {confirmCancel ? (
                        <div className="rounded-xl border border-danger-strong/30 bg-danger-strong/[0.07] p-3.5 space-y-3">
                          <p className="text-[13px] text-white/80 leading-relaxed">
                            Cancel this registration? Nothing has been submitted and no place is held,
                            so if the payment failed you can start again from the beginning.
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setConfirmCancel(false)} className={`${ghostBtn} flex-1`}>
                              Keep going
                            </Button>
                            <Button
                              onClick={restartRegistration}
                              className="flex-1 h-[38px] rounded-2xl bg-danger-strong/80 text-white hover:bg-danger-strong font-medium cursor-pointer"
                            >
                              Yes, cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        confirmSubmit ? (
                          /* Last stop before the money is filed as paid: the
                             ₹200 is already with the college, and cancelling
                             afterwards does not bring it back. */
                          <div className="rounded-xl border border-soft-gold/25 bg-soft-gold/[0.07] p-3.5 space-y-3">
                            <p className="text-[13px] text-white/80 leading-relaxed">
                              Submit with transaction ID{" "}
                              <span className="text-white font-medium break-all">{form.paymentRef.trim()}</span>?
                            </p>
                            <p className="text-[12px] text-white/55 leading-relaxed">
                              Check it matches your receipt — we verify it against the portal&apos;s
                              statement. The {applicantFee} is already with the college, and cancelling
                              after this does not refund it. (If the event fills up and you are not
                              confirmed, the full fee is returned.)
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline" onClick={() => setConfirmSubmit(false)}
                                className={`${ghostBtn} flex-1`}>
                                Go back
                              </Button>
                              <Button onClick={() => submit()} disabled={submitting} className={`${primaryBtn} flex-1`}>
                                {submitting ? (
                                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                                ) : (
                                  "Yes, submit" )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setConfirmCancel(true)}
                            className={`${ghostBtn} px-4`}
                            aria-label="Cancel registration"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              if (!isValidPaymentRef(form.paymentRef)) return fail(PAYMENT_REF_HINT);
                              setError(null);
                              setConfirmSubmit(true);
                            }}
                            disabled={submitting}
                            className={`${primaryBtn} flex-1`}>
                            Submit application
                          </Button>
                        </div>
                        )
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <DialogTitle className="sr-only">Application under review</DialogTitle>
              <DialogDescription className="sr-only">{result.eventName}</DialogDescription>
              <ApplicationReviewCard
                result={result}
                copied={copied}
                onCopyCode={handleCopyCode}
                onClose={close}
              />
            </>
          )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
