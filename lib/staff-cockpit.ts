import { devEmailFromCookieHeader } from "@/lib/dev-identity";

type RoleKind = "organiser" | "coordinator" | "none";

export const STAFF_HOME = "/dashboard";

export const STAFF_CANNOT_APPLY =
  "Staff accounts cannot register for events.";

export function isStaffRole(
  kind: RoleKind | string | null | undefined
): boolean {
  return kind === "organiser" || kind === "coordinator";
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
  if (p.startsWith("/admin")) return true;
  if (p === "/ticket" || p.startsWith("/ticket/")) return true;
  if (p === "/tickets" || p.startsWith("/tickets/")) return true;
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

/** `/dashboard` when this staff member is on a public page; otherwise null.
 *
 * Organisers bounce off the marketing home. Coordinators bounce off that
 * home too, but they keep `/events` and `/events/[slug]` so they can still
 * see the event they run — Request to Join stays hidden; names and posters
 * stay public. Visitors are never redirected. */
export function staffCockpitRedirect(
  pathname: string,
  roleKind: RoleKind | string | null | undefined
): string | null {
  if (!isStaffRole(roleKind)) return null;
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
