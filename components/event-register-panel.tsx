"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RegistrationDialog } from "@/components/registration-dialog";
import { TeamInviteCard, useMyTeam } from "@/components/team-invite-card";
import { Event, eventId, capacityFor, maxTeamsFor, effectiveRegistrationState, type RegistrationState } from "@/lib/pravrutti-data";
import { FEE_PER_HEAD, isLiveApplication, type AppStatus } from "@/lib/applications";
import { IndianRupee, Ticket, UserCheck } from "lucide-react";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { isStaffRole } from "@/lib/staff-cockpit";
import { isDiscoverize } from "@/lib/discoverize";

/**
 * The registration card, in Luma's shape: a labelled panel that states the
 * approval rule, how full the event is, and one primary action.
 *
 * Rendered by both the event page and the slide-over panel. The panel used to
 * carry its own copy, which is how the two ended up quoting seats differently.
 *
 * `onRegisterOpenChange` lets the slide-over collapse itself while the apply
 * dialog is up, rather than stacking two modal layers on a phone.
 */
export function EventRegisterPanel({
  event,
  level = 2,
  onRegisterOpenChange,
  onAccessRefresh,
  viewerStatus = null,
  viewerReady = true,
  awaitingReference = false,
  unanswered = false,
}: {
  event: Event;
  level?: 2 | 3;
  onRegisterOpenChange?: (open: boolean) => void;
  /** Re-ask /api/events/coordinators after a successful submit. Capacity
      alone is not enough — that count is global, not this viewer's status. */
  onAccessRefresh?: () => void;
  /** This viewer's application to THIS event. Confirmed hides the card;
      pending or confirmed hides Request to Join. */
  viewerStatus?: AppStatus | null;
  /** False until /api/events/coordinators has answered, so Request to Join
      cannot flash for someone who already applied. */
  viewerReady?: boolean;
  /** They went to pay and never came back with a transaction ID. They already
      have a registration, so Request to Join is rightly hidden — but the step
      that takes the reference existed only in the tab they left, so without a
      way back there is nowhere to finish. */
  awaitingReference?: boolean;
  /** They left for the portal and never said how it went. The page owes them
      the question, not a demand for a transaction ID. */
  unanswered?: boolean;
}) {
  const id = eventId(event.name);
  const cap = capacityFor(id);
  const Heading = level === 2 ? "h2" : "h3";
  const dash = useDashboardRole();
  const staff = isStaffRole(dash.role);

  const [count, setCount] = useState<number | null>(null);
  /* Teams confirmed so far, for events whose field is stated in teams. */
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [open, setOpen] = useState(false);
  /* Starts open and closes on mount rather than being read during render. This
     card is now prerendered into all 24 static event pages, and a clock read at
     render time disagrees with the build-time HTML the moment the deadline
     passes without a redeploy — a hydration mismatch on the primary button. */
  const [regState, setRegState] = useState<RegistrationState>("open");
  const closed = regState !== "open";

  useEffect(() => {
    setRegState(effectiveRegistrationState());
  }, []);

  const load = useCallback(() => {
    fetch(`/api/register?event=${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCount(d.confirmed?.[id] ?? 0);
        setTeamCount(d.confirmedTeams?.[id] ?? 0);
        setWaiting(d.pending?.[id] ?? 0);
      })
      .catch(() => {
        setCount(null);
        setTeamCount(null);
      });
  }, [id]);

  useEffect(load, [load]);

  const live = isLiveApplication(viewerStatus);

  /* The shareable code is permanent — restore it after submit so the lead can
     still invite until the event's max size. Confirmed viewers skip the
     registration card, so this fetch is also how they see the code. Pulses so
     a joiner's name appears without a reload. */
  const mine = useMyTeam(id, live && viewerReady && dash.ready && !staff);

  const handleRegistered = useCallback(() => {
    load();
    onAccessRefresh?.();
  }, [load, onAccessRefresh]);

  const setRegistering = (v: boolean) => {
    setOpen(v);
    onRegisterOpenChange?.(v);
  };

  /* Opening to finish a payment rather than to start a registration: either
     to answer the question they never got, or to add the optional ID. */
  const [resuming, setResuming] = useState<"answer" | "reference" | "pay" | null>(null);
  const openToFinish = (mode: "answer" | "reference" | "pay") => {
    setResuming(mode);
    setRegistering(true);
  };

  /* Count in teams wherever the event states its field that way — that is the
     unit people register in. Events whose cap is in people (solo-allowed ones)
     keep counting heads, because a team figure there would misstate the field. */
  const maxTeams = maxTeamsFor(event);
  const inTeams = maxTeams !== null;
  const unit = inTeams ? "team" : "seat";

  const ready = inTeams ? teamCount !== null : count !== null;
  const total = inTeams ? maxTeams : cap;
  const taken = (inTeams ? teamCount : count) ?? 0;
  const left = Math.max(total - taken, 0);
  const full = ready && left === 0;
  const pct = Math.min((taken / Math.max(total, 1)) * 100, 100);
  const invite = mine ? <TeamInviteCard team={mine} level={level} /> : null;

  /* Confirmed viewers already have a ticket — the card's job (explain approval
     and collect a new application) would contradict "You're going". They still
     get the team code so they can invite after submit. */
  if (dash.ready && staff) return null;
  if (viewerReady && viewerStatus === "confirmed") return invite;

  const showApply = viewerReady && dash.ready && !live && !closed && !staff;
  const showClosed = viewerReady && !live && closed;
  /* Two different people are pending without a reference. One left for the
     portal and never told us how it went — they get the question. The other
     already answered "yes, I've paid" without an ID: that registration is
     complete, and the ID is a small optional extra, never pressed for. */
  const showAnswer = viewerReady && dash.ready && unanswered && !staff;
  /* Discoverize owes nothing until the judges put a team through, and then it
     owes the whole fee — so "awaiting" there is a fee to pay, not a reference
     to remember. */
  const discoverize = isDiscoverize(id);
  const showPayRound = viewerReady && dash.ready && discoverize && awaitingReference && !staff;
  const showAddRef =
    viewerReady && dash.ready && awaitingReference && !unanswered && !staff && !discoverize;

  /* A reminder email's button lands here with ?finish=reference. Open the
     screen it promised, once, the moment we know they are owed it. Read from
     the URL in an effect rather than useSearchParams: these pages are
     prerendered, and that hook would demand a Suspense boundary for it. */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !(showAnswer || showAddRef || showPayRound)) return;
    const finish = new URLSearchParams(window.location.search).get("finish");
    if (finish !== "reference" && finish !== "pay") return;
    deepLinked.current = true;
    openToFinish(finish === "pay" ? "pay" : showAnswer ? "answer" : "reference");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, showAddRef, showPayRound]);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-royal-wine bg-cosmic-purple/70 backdrop-blur-md overflow-hidden cyber-box">
        <div className="px-4 py-2.5 bg-midnight-navy/80 border-b border-royal-wine">
          <Heading className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-pearl-white/55">
            Registration
          </Heading>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full border border-royal-wine bg-midnight-navy flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-champagne-gold" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-pearl-white">
                {viewerStatus === "pending" ? "In review" : "Approval required"}
              </p>
              <p className="text-xs text-pearl-white/60 leading-relaxed">
                {viewerStatus === "pending" ? "Organisers are reviewing your registration. You\u2019ll hear back before they issue a ticket." : "Your registration is reviewed by the organisers before it is confirmed."}
              </p>
            </div>
          </div>

          <p className="flex items-center gap-2 text-sm text-pearl-white/80">
            <IndianRupee className="w-3.5 h-3.5 shrink-0 text-cyber-pink" aria-hidden="true" />
            {FEE_PER_HEAD} per team · paid online by the lead
          </p>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[10px] uppercase tracking-widest text-pearl-white/45">
                {inTeams ? "Teams confirmed" : "Seats confirmed"}
              </span>
              <span className="font-display text-xs font-black text-champagne-gold tabular-nums">
                {!ready ? "—" : `${taken} of ${total}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-midnight-navy border border-royal-wine overflow-hidden">
              {ready && (
                <div
                  className={`h-full animate-meter ${full ? "bg-soft-gold" : "bg-cyber-pink"}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              )}
            </div>
            {waiting > 0 && (
              <p className="text-xs text-pearl-white/45">
                {waiting} {waiting === 1 ? "application" : "applications"} in review
              </p>
            )}
            {!full && ready && left <= 15 && (
              <p className="text-xs text-soft-gold animate-seat-blink">
                Filling fast — {left} {left === 1 ? unit : `${unit}s`} left to confirm
              </p>
            )}
          </div>

          {showApply && (
            <Button
              onClick={() => setRegistering(true)}
              className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer" >
              <Ticket className="w-4 h-4 mr-2" aria-hidden="true" />
              {full ? "Apply · join the queue" : "Request to join"}
            </Button>
          )}
          {showAnswer && (
            <div className="space-y-2">
              <Button
                onClick={() => openToFinish("answer")}
                className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer"
              >
                <Ticket className="w-4 h-4 mr-2" aria-hidden="true" />
                Did your payment go through?
              </Button>
              <p className="text-xs text-pearl-white/50 leading-relaxed">
                You left for the payment portal and we haven&apos;t heard back. Your place
                is held either way — just tell us how it went.
              </p>
            </div>
          )}
          {showPayRound && (
            <div className="space-y-2">
              <Button
                onClick={() => openToFinish("pay")}
                className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer"
              >
                <IndianRupee className="w-4 h-4 mr-2" aria-hidden="true" />
                Pay ₹{FEE_PER_HEAD}
              </Button>
              <p className="text-xs text-pearl-white/50 leading-relaxed">
                Your team is shortlisted for the presentation round. The ₹{FEE_PER_HEAD} is for the
                team, paid once by the lead — your place is held while you pay.
              </p>
            </div>
          )}
          {showAddRef && (
            <button
              type="button"
              onClick={() => openToFinish("reference")}
              className="block text-left text-xs text-pearl-white/45 hover:text-pearl-white/80 underline underline-offset-2 cursor-pointer"
            >
              Have your Juno transaction ID? Add it (optional)
            </button>
          )}
          {showClosed && (
            <Button
              disabled
              className={
                regState === "upcoming"
                  ? "w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest bg-champagne-gold/10 text-champagne-gold/80 border border-champagne-gold/30"
                  : "w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest bg-electric-magenta/10 text-electric-magenta/70 border border-electric-magenta/30"
              }
            >
              {regState === "upcoming" ? "Registration opens soon" : "Registration closed"}
            </Button>
          )}
        </div>
      </section>

      {viewerStatus === "pending" ? invite : null}

      <RegistrationDialog
        /* Stay open on `open`, not `showApply`. Refreshing access after
           submit flips showApply to false; gating here would unmount the
           success screen before they can read the queue position. */
        event={open ? event : null}
        onClose={() => { setRegistering(false); setResuming(null); }}
        resumeAtReference={resuming === "answer" || resuming === "reference"}
        resumeWithReferenceField={resuming === "reference"}
        resumeAtPayment={resuming === "pay"}
        onRegistered={handleRegistered}
        seatsLeft={left}
      />
    </div>
  );
}
