"use client";

import { useCallback, useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity-context";
import type { AppStatus } from "@/lib/applications";

export type CoordinatorPhones = {
  /** False until the server has answered — don't read `unlocked` yet. */
  ready: boolean;
  /** True when this viewer is entitled to the private details of this event. */
  unlocked: boolean;
  /** True when this viewer has a live application (pending or confirmed) for
      this event, or is staff who may run it. Contact/More, not phones. */
  registered: boolean;
  /** Coordinator name → phone. Filled once the coordinators endpoint answers. */
  byName: Record<string, string>;
  /** The exact hall. Null unless unlocked, or when none is assigned yet. */
  venue: string | null;
  /** This viewer's own application to this event, if they have one. */
  status: AppStatus | null;
  /** They went to pay and have not come back with a transaction ID. */
  awaitingReference: boolean;
};

const LOCKED: CoordinatorPhones = {
  ready: true, unlocked: false, registered: false, byName: {}, venue: null, status: null,
  awaitingReference: false,
};
const PENDING: CoordinatorPhones = {
  ready: false, unlocked: false, registered: false, byName: {}, venue: null, status: null,
  awaitingReference: false,
};

/**
 * Everything about one event that depends on who is looking: the coordinators'
 * numbers, the exact hall, and this viewer's own application status.
 *
 * Numbers are not in the page or the bundle. They arrive from
 * /api/events/coordinators for any valid slug, including signed-out visitors,
 * so Hosted By can show a working tel: control before anyone registers. The
 * hall still waits on `unlocked`.
 *
 * One hook and one request for all three. Splitting them would mean three
 * round trips and three chances for the page to contradict itself.
 *
 * `enabled` lets a closed panel skip the request until it opens.
 *
 * `refresh` is how the page asks again after a successful apply: identity
 * does not change, so without a tick the hook would keep the pre-submit
 * answer and Request to Join would stay on screen.
 */
export function useCoordinatorPhones(
  slug: string,
  enabled = true,
): CoordinatorPhones & { refresh: () => void } {
  const me = useIdentity();
  const [state, setState] = useState<CoordinatorPhones>(PENDING);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !slug) {
      setState(PENDING);
      return;
    }
    if (!me.ready) return;

    let cancelled = false;
    setState(PENDING);
    fetch(`/api/events/coordinators?event=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { unlocked: false, registered: false }))
      .then((d: {
        unlocked?: boolean;
        registered?: boolean;
        venue?: string | null;
        status?: AppStatus | null;
        awaitingReference?: boolean;
        contacts?: { name: string; phone: string }[];
      }) => {
        if (cancelled) return;
        const byName: Record<string, string> = {};
        for (const c of d.contacts ?? []) byName[c.name] = c.phone;
        setState({
          ready: true,
          unlocked: Boolean(d.unlocked),
          /* Pending applicants are registered but not unlocked. Never infer
             registered from unlocked alone in the other direction — that would
             hide Contact/More from someone still in review. */
          registered: Boolean(d.registered),
          byName,
          venue: d.venue ?? null,
          status: d.status ?? null,
          awaitingReference: d.awaitingReference === true,
        });
      })
      // A failed lookup must read as "no number", never as an open door.
      .catch(() => { if (!cancelled) setState(LOCKED); });

    return () => { cancelled = true; };
  }, [slug, enabled, me.ready, me.signedIn, me.email, tick]);

  return { ...state, refresh };
}
