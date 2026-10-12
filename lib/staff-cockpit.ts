import { devEmailFromCookieHeader } from "@/lib/dev-identity";

type RoleKind = "organiser" | "coordinator" | "registration" | "none";

export const STAFF_HOME = "/dashboard";
export const STAFF_DESK = "/desk";

export const STAFF_CANNOT_APPLY =
  "Staff accounts cannot register for events.";

export function isStaffRole(
  kind: RoleKind | string | null | undefined
): boolean {
  return kind === "organiser" || kind === "coordinator" || kind === "registration";
}

/** Where this staff member lands when bounced off a public page. */
export function staffHomeFor(kind: RoleKind | string | null | undefined): string {
  return kind === "registration" ? STAFF_DESK : STAFF_HOME;
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * Surfaces every staff member may stay on. Everything else is a visitor
 * marketing page — except public event pages, which coordinators may keep
 * (see staffCockpitRedirect).
 *
 * This module must stay free of `resolveRole` / `lib/identity` — navigation
 * and the register panel import it from client components.
 */
export function isStaffAllowedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p.startsWith("/api")) return true;
  if (p.startsWith("/dashboard")) return true;
  if (p === "/desk" || p.startsWith("/desk/")) return true;
  /* A coordinator who also leads a Hacktivate team still has to lock a track. */
  if (p === "/hacktivate/track" || p.startsWith("/hacktivate/")) return true;
  if (p.startsWith("/admin")) return true;
  if (p === "/faculty" || p.startsWith("/faculty/")) return true;
  if (p === "/ticket" || p.startsWith("/ticket/")) return true;
  if (p === "/tickets" || p.startsWith("/tickets/")) return true;
  if (p === "/sso-callback" || p.startsWith("/sso-callback/")) return true;
  if (p.startsWith("/__clerk")) return true;
  return false;
}

/**
 * Paths a registration-desk volunteer may stay on. Deliberately narrower than
 * organiser/coordinator — no dashboard, admin, faculty, or ticket surfaces.
 */
export function isRegistrationAllowedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p.startsWith("/api")) return true;
  if (p === "/desk" || p.startsWith("/desk/")) return true;
  if (p === "/sso-callback" || p.startsWith("/sso-callback/")) return true;
  if (p.startsWith("/__clerk")) return true;
  return false;
}

/** Listing + `/events/[slug]`. Visitors and students always reach these;
    coordinators need them too, because they run an event they cannot apply to. */
export function isPublicEventPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/events" || p.startsWith("/events/");
}

/** Staff home when this person is on a public page; otherwise null.
 *
 * Organisers bounce off the marketing home. Coordinators bounce off that
 * home too, but they keep `/events` and `/events/[slug]` so they can still
 * see the event they run — Request to Join stays hidden; names and posters
 * stay public. Registration desk volunteers bounce to `/desk` and cannot
 * open organiser tools. Visitors are never redirected. */
export function staffCockpitRedirect(
  pathname: string,
  roleKind: RoleKind | string | null | undefined
): string | null {
  if (!isStaffRole(roleKind)) return null;
  if (roleKind === "registration") {
    if (isRegistrationAllowedPath(pathname)) return null;
    return STAFF_DESK;
  }
  if (isStaffAllowedPath(pathname)) return null;
  if (roleKind === "coordinator" && isPublicEventPath(pathname)) return null;
  return STAFF_HOME;
}

export function staffBlocksApplication(
  sessionKind: RoleKind | string | null | undefined,
  applicantKind: RoleKind | string | null | undefined
): boolean {
  return isStaffRole(sessionKind) || isStaffRole(applicantKind);
}

export function staffEmailFromCookieHeader(
  header: string | null | undefined
): string | null {
  return devEmailFromCookieHeader(header);
}

export function emailFromSessionClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;
  const nested =
    c.user && typeof c.user === "object"
      ? (c.user as Record<string, unknown>)
      : null;
  const raw = [
    c.email,
    c.email_address,
    c.primaryEmail,
    c.primary_email,
    c.primary_email_address,
    nested?.email,
    nested?.primary_email_address,
  ].find((v) => typeof v === "string" && v.trim());
  return raw ? String(raw).trim().toLowerCase() : null;
}
