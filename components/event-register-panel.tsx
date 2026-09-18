"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RegistrationDialog } from "@/components/registration-dialog";
import { TeamInviteCard, useMyTeam } from "@/components/team-invite-card";
import { Event, eventId, capacityFor, maxTeamsFor, effectiveRegistrationState, type RegistrationState } from "@/lib/pravrutti-data";
import { FEE_PER_HEAD, isLiveApplication, type AppStatus } from "@/lib/applications";
import { IndianRupee, Ticket, UserCheck } from "lucide-react";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { isStaffRole } from "@/lib/staff-cockpit";

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

  const registrationDisabled = true; // Registration is closed while the payment flow is fixed
  const showApply = !registrationDisabled && viewerReady && dash.ready && !live && !closed && !staff;
  const showClosed = viewerReady && !live && closed;

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
          {registrationDisabled && viewerReady && (
            <Button
              disabled
              className="w-full h-12 rounded-xl font-display text-xs font-black uppercase tracking-widest bg-champagne-gold/10 text-champagne-gold/80 border border-champagne-gold/30"
            >
              Registration opens soon
            </Button>
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
        onClose={() => setRegistering(false)}
        onRegistered={handleRegistered}
        seatsLeft={left}
      />
    </div>
  );
}
