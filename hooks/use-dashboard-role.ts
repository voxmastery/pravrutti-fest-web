"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity-context";

export type DashboardEvent = { eventId: string; name: string };

export type DashboardRole = {
  /** Resolved server-side from the signed-in Google address. */
  role: "organiser" | "coordinator" | "none";
  /** Every event for an organiser; just their own for a coordinator. */
  events: DashboardEvent[];
  /** False until the answer is back — don't flash a link then remove it. */
  ready: boolean;
};

const NONE: DashboardRole = { role: "none", events: [], ready: false };

/**
 * Whether the signed-in person has a dashboard, and which events it covers.
 *
 * The role is never inferred on the client — this only reports what the server
 * already decided in /api/dashboard/me. Hiding or showing a link is
 * presentation; every dashboard endpoint re-derives the role and re-checks
 * scope regardless of what the UI offered.
 */
export function useDashboardRole(): DashboardRole {
  const me = useIdentity();
  const [state, setState] = useState<DashboardRole>(NONE);

  useEffect(() => {
    if (!me.ready) return;

    // Signed out is a definite answer, not a pending one.
    if (!me.signedIn) {
      setState({ role: "none", events: [], ready: true });
      return;
    }

    let cancelled = false;
    fetch("/api/dashboard/me")
      .then((r) => (r.ok ? r.json() : { role: "none", events: [] }))
      .then((d) => {
        if (cancelled) return;
        setState({ role: d.role ?? "none", events: d.events ?? [], ready: true });
      })
      .catch(() => {
        // A failed lookup must not grant access it couldn't confirm.
        if (!cancelled) setState({ role: "none", events: [], ready: true });
      });

    return () => {
      cancelled = true;
    };
  }, [me.ready, me.signedIn, me.email]);

  return state;
}

/** Menu wording, so organisers and coordinators aren't told the same thing. */
export function dashboardLabel(r: DashboardRole): string {
  if (r.role === "organiser") return "Organiser dashboard";
  if (r.events.length > 1) return "My events";
  return "My event dashboard";
}
