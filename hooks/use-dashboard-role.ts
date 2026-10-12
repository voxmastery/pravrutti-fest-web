"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity-context";

export type DashboardEvent = { eventId: string; name: string };

export type DashboardRole = {
  /** Resolved server-side from the signed-in Google address. */
  role: "organiser" | "coordinator" | "registration" | "none";
  /** Every event for an organiser or desk volunteer; just their own for a coordinator. */
  events: DashboardEvent[];
  /** Whether the read-only faculty board (/faculty) is open to them. */
  faculty: boolean;
  /** False until the answer is back — don't flash a link then remove it. */
  ready: boolean;
};

const NONE: DashboardRole = { role: "none", events: [], faculty: false, ready: false };

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
      setState({ role: "none", events: [], faculty: false, ready: true });
      return;
    }

    let cancelled = false;
    fetch("/api/dashboard/me")
      .then((r) => (r.ok ? r.json() : { role: "none", events: [], faculty: false }))
      .then((d) => {
        if (cancelled) return;
        setState({ role: d.role ?? "none", events: d.events ?? [], faculty: d.faculty === true, ready: true });
      })
      .catch(() => {
        // A failed lookup must not grant access it couldn't confirm.
        if (!cancelled) setState({ role: "none", events: [], faculty: false, ready: true });
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
  if (r.role === "registration") return "Registration desk";
  if (r.events.length > 1) return "My events";
  return "My event dashboard";
}
