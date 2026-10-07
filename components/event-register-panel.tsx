"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RegistrationDialog } from "@/components/registration-dialog";
import { TeamInviteCard, useMyTeam } from "@/components/team-invite-card";
import { Event, eventId, capacityFor, maxTeamsFor, effectiveRegistrationState, festFor, eventClosesDisplay, type RegistrationState } from "@/lib/pravrutti-data";
import { FEE_PER_HEAD, isLiveApplication, type AppStatus } from "@/lib/applications";
import { Clock, IndianRupee, Ticket, UserCheck } from "lucide-react";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { isStaffRole } from "@/lib/staff-cockpit";
import { DiscoverizeGroupCard } from "@/components/discoverize-group-card";
import {
  isDiscoverize,
  discoverizeState,
  DISCOVERIZE_STATE_LABEL,
  DISCOVERIZE_STATE_BLURB,
  ABSTRACT_FORM_URL,
  DISCOVERIZE_SHORTLIST_CONGRATS,
} from "@/lib/discoverize";
import { registerNoteText } from "@/lib/register-note";

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
/** "tonight at 11:59 PM" on the closing day itself, the full date otherwise. */
function closesLabel(iso: string): string {
  const IST = 330 * 60 * 1000;
  const close = new Date(Date.parse(iso) + IST);
  const now = new Date(Date.now() + IST);
  const sameDay = close.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  const full = eventClosesDisplay({ registrationCloses: iso });
  return sameDay ? `tonight at ${full.split(",")[0]}` : `at ${full}`;
}

export function EventRegisterPanel({
  event,
  level = 2,
  onRegisterOpenChange,
  onAccessRefresh,
  viewerStatus = null,
  viewerReady = true,
  awaitingReference = false,
  unanswered = false,
  round = null,
  viewerPayment = null,
  phones = {},
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
  /** Discoverize's rounds for this viewer; null for every other event. */
  round?: { abstractSubmittedAt?: string; shortlistedAt?: string; paymentSubmittedAt?: string } | null;
  /** This viewer's own payment state, needed to tell a free Discoverize entry
      from a shortlisted team that owes the team fee. */
  viewerPayment?: "not_required" | "awaiting" | "paid" | "refunded" | null;
  /** Coordinator name → phone, from /api/events/coordinators. Fills
      `{phone}` in a register note. Empty until that route has answered. */
  phones?: Record<string, string>;
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
  /* Teams in review, for events counted in teams: "11 applications in
     review" on Pitch at Mach was eleven people in four teams, read as
     eleven teams beside "7 teams confirmed". The number is teams with
     nobody confirmed yet — the same inReviewTeams the faculty desk shows. */
  const [waitingTeams, setWaitingTeams] = useState(0);
  /* Full by the server's count — at its cap — as well as by hand. */
  const [serverFull, setServerFull] = useState(false);
  const [open, setOpen] = useState(false);
  /* Starts open and closes on mount rather than being read during render. This
     card is now prerendered into all 24 static event pages, and a clock read at
     render time disagrees with the build-time HTML the moment the deadline
     passes without a redeploy — a hydration mismatch on the primary button. */
  const [regState, setRegState] = useState<RegistrationState>("open");
  /* Read on the client only: "tonight" depends on today's date, and this card
     is prerendered, so computing it during render would mismatch hydration. */
  const [closesText, setClosesText] = useState("");
  const closed = regState !== "open";

  useEffect(() => {
    /* festFor: an event can close before the fest-wide date. Re-checked each
       minute so an open tab flips to closed at the deadline. */
    const check = () => {
      setRegState(effectiveRegistrationState(undefined, festFor(event)));
      setClosesText(event.registrationCloses ? closesLabel(event.registrationCloses) : "");
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [event]);

  const load = useCallback(() => {
    fetch(`/api/register?event=${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCount(d.confirmed?.[id] ?? 0);
        setTeamCount(d.confirmedTeams?.[id] ?? 0);
        setWaiting(d.pending?.[id] ?? 0);
        setWaitingTeams(d.pendingTeams?.[id] ?? 0);
        setServerFull(Boolean(d.full?.[id]));
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

  /* Switched to full by the organisers (Event.full). The counter only counts
     confirmed teams, so on its own it read "37 of 45" while 52 teams already
     held places — and invited more. When the event is closed it says so. */
  const closedFull = !!event.full || serverFull;
  /* The form reads event.full to drop "Create team" and the fee; an event
     full by its count has to look the same to it. Memoised so the form's
     effects, which depend on the event, do not re-run every render. */
  const dialogEvent = useMemo(
    () => (closedFull === !!event.full ? event : { ...event, full: closedFull }),
    [event, closedFull],
  );
  /* No stated cap (CHAOS, Hacktivate): capacityFor falls back to a placeholder
     100, which put "231 of 100" on the page. With nothing to measure against,
     show the confirmed count alone — no "of", no bar, no "filling fast". */
  const uncapped = !inTeams && !event.capacity;
  const countTeams = inTeams || (uncapped && event.capacityUnit === "teams");
  const ready = closedFull || (countTeams ? teamCount !== null : count !== null);
  const total = inTeams ? maxTeams : cap;
  const taken = (countTeams ? teamCount : count) ?? 0;
  const left = closedFull ? 0 : uncapped ? Infinity : Math.max(total - taken, 0);
  const full = closedFull || (ready && left === 0);
  const pct = closedFull ? 100 : Math.min((taken / Math.max(total, 1)) * 100, 100);
  const invite = mine ? <TeamInviteCard team={mine} level={level} /> : null;

  const showApply = viewerReady && dash.ready && !live && !closed && !staff && !closedFull;
  /* The number is not on the event. It arrives with the call-button lookup,
     which is the same moment Request to join is allowed on screen. */
  const note = registerNoteText(event.registerNote, event.registerNoteCoordinator, phones);
  /* Full is not shut: someone on a team that is already in still needs a way
     to join it — Nexovate's members did, the day it filled. */
  const showJoinOnly = viewerReady && dash.ready && !live && !closed && !staff && closedFull;
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
  /* Where this team stands in Discoverize's rounds — the same derivation the
     ticket page and the server use, so the button here cannot offer a step
     the endpoint would refuse. */
  const roundState = discoverizeState({
    status: viewerStatus ?? "pending",
    payment: viewerPayment ?? "not_required",
    round: round ?? undefined,
  });
  const showAddRef =
    viewerReady && dash.ready && awaitingReference && !unanswered && !staff &&
    (!discoverize || roundState === "payment_submitted");
  /* A Discoverize team the coordinators shortlisted, whose payer still owes
     the team's ₹200. No other Discoverize team, and no other event, ever
     reaches this — the server decides who is shortlisted. */
  const showPayRound =
    viewerReady && dash.ready && discoverize && live && roundState === "payment_pending" && !staff;

  /* A reminder email's button lands here with ?finish=reference. Open the
     screen it promised, once, the moment we know they are owed it. Read from
     the URL in an effect rather than useSearchParams: these pages are
     prerendered, and that hook would demand a Suspense boundary for it. */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !(showAnswer || showAddRef || showPayRound)) return;
    const finish = new URLSearchParams(window.location.search).get("finish");
    /* My tickets' "Pay ₹200" lands here with ?finish=pay. */
    if (finish === "pay" && showPayRound) {
      deepLinked.current = true;
      openToFinish("pay");
      return;
    }
    if (finish !== "reference" || !(showAnswer || showAddRef)) return;
    deepLinked.current = true;
    openToFinish(showAnswer ? "answer" : "reference");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, showAddRef, showPayRound]);

  /* Confirmed viewers already have a ticket — the card's job (explain approval
     and collect a new application) would contradict "You're going". They still
     get the team code so they can invite after submit.

     Below every hook, never above one. These returns once sat above the
     deep-link effect, so a viewer who became confirmed while the page was
     open — exactly what joining an approved team now does — rendered two
     fewer hooks than the render before, and the page fell over with "This
     page couldn't load". test/event-register-panel-hooks keeps them here. */
  if (dash.ready && staff) return null;
  if (viewerReady && viewerStatus === "confirmed") return invite;

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
                {discoverize && live
                  ? DISCOVERIZE_STATE_LABEL[roundState]
                  : viewerStatus === "pending" ? "In review" : "Approval required"}
              </p>
              <p className="text-xs text-pearl-white/60 leading-relaxed">
                {discoverize && live
                  ? DISCOVERIZE_STATE_BLURB[roundState]
                  : viewerStatus === "pending" ? "Organisers are reviewing your registration. You\u2019ll hear back before they issue a ticket." : "Your registration is reviewed by the organisers before it is confirmed."}
              </p>
            </div>
          </div>

          <p className="flex items-center gap-2 text-sm text-pearl-white/80">
            <IndianRupee className="w-3.5 h-3.5 shrink-0 text-cyber-pink" aria-hidden="true" />
            {/* Discoverize charges past its shortlist, not at the door. */}
            {discoverize
              ? live && (roundState === "payment_pending" || roundState === "payment_submitted")
                ? `${FEE_PER_HEAD} per team · shortlisted, paid online by the lead`
                : `Free to enter · ${FEE_PER_HEAD} per team only if shortlisted`
              : `${FEE_PER_HEAD} per team · paid online by the lead`}
          </p>

          {closesText && regState === "open" && (
            <p className="flex items-center gap-2 text-sm font-semibold text-soft-gold">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Registration closes {closesText} IST
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[10px] uppercase tracking-widest text-pearl-white/45">
                {closedFull ? "Registrations" : countTeams ? "Teams confirmed" : "Seats confirmed"}
              </span>
              <span className="font-display text-xs font-black text-champagne-gold tabular-nums">
                {closedFull ? "Full" : !ready ? "—" : uncapped ? `${taken}` : `${taken} of ${total}`}
              </span>
            </div>
            {!uncapped && <div className="h-2 rounded-full bg-midnight-navy border border-royal-wine overflow-hidden">
              {ready && (
                <div
                  className={`h-full animate-meter ${full ? "bg-soft-gold" : "bg-cyber-pink"}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              )}
            </div>}
            {closedFull && (
              <p className="text-xs text-pearl-white/60 leading-relaxed">
                {`${event.name} isn’t taking new teams. Teams already registered are unaffected.`}
              </p>
            )}
            {(countTeams ? waitingTeams : waiting) > 0 && !closedFull && (
              <p className="text-xs text-pearl-white/45">
                {countTeams
                  ? `${waitingTeams} ${waitingTeams === 1 ? "team" : "teams"} in review`
                  : `${waiting} ${waiting === 1 ? "application" : "applications"} in review`}
              </p>
            )}
            {!full && ready && left <= 15 && (
              <p className="text-xs text-soft-gold animate-seat-blink">
                Filling fast — {left} {left === 1 ? unit : `${unit}s`} left to confirm
              </p>
            )}
          </div>

          {showApply && (
            <div className="space-y-2">
              <Button
                onClick={() => setRegistering(true)}
                className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer" >
                <Ticket className="w-4 h-4 mr-2" aria-hidden="true" />
                {full ? "Apply · join the queue" : "Request to join"}
              </Button>
              {note ? (
                <p className="text-xs leading-relaxed text-pearl-white/80">
                  {note}
                </p>
              ) : null}
            </div>
          )}
          {showJoinOnly && (
            <div className="space-y-2">
              <Button
                disabled
                className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest bg-electric-magenta/10 text-electric-magenta/70 border border-electric-magenta/30"
              >
                Full · no new teams
              </Button>
              <button
                type="button"
                onClick={() => setRegistering(true)}
                className="block w-full text-center text-xs text-pearl-white/60 hover:text-pearl-white underline underline-offset-2 cursor-pointer"
              >
                Already on a registered team? Join it with your team code
              </button>
            </div>
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
          {/* Registered for Discoverize, at any stage of its rounds. The card
              asks the server whether this viewer may have the invite and
              draws nothing if the answer is no, so it is safe to place
              wherever a registered team can see it. */}
          {discoverize && live && <DiscoverizeGroupCard compact />}
          {discoverize && live && roundState === "registered" && (
            <div className="space-y-2">
              <a href={ABSTRACT_FORM_URL} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer">
                  <Ticket className="w-4 h-4 mr-2" aria-hidden="true" />
                  Submit abstract
                </Button>
              </a>
              <p className="text-xs text-pearl-white/50 leading-relaxed">
                Your ticket updates on its own once the form receives it. You can come back to this
                from My tickets.
              </p>
            </div>
          )}
          {showPayRound && (
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() => openToFinish("pay")}
                className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer"
              >
                <IndianRupee className="w-4 h-4 mr-2" aria-hidden="true" />
                Pay ₹{FEE_PER_HEAD}
              </Button>
              <p className="text-xs font-semibold text-emerald-400">{DISCOVERIZE_SHORTLIST_CONGRATS}</p>
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
        event={open ? dialogEvent : null}
        onClose={() => { setRegistering(false); setResuming(null); }}
        resumeAtReference={resuming === "answer" || resuming === "reference"}
        resumeAtPayment={resuming === "pay"}
        resumeWithReferenceField={resuming === "reference"}
        onRegistered={handleRegistered}
        seatsLeft={left}
      />
    </div>
  );
}
