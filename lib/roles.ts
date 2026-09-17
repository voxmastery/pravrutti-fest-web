import { events, eventId } from "@/lib/pravrutti-data";

export type Role =
  | { kind: "organiser" }
  | { kind: "coordinator"; eventIds: string[] }
  | { kind: "none" };

/**
 * Coordinator dashboards are switched off for now.
 *
 * Off means a coordinator keeps their staff identity — they still cannot
 * register for events, and they are still bounced off the marketing pages —
 * but they hold access to no event, so every canViewEvent() check fails and no
 * dashboard route will hand them data. Deliberately narrower than demoting
 * them to "none", which would quietly let a coordinator apply to the event
 * they run.
 *
 * Flip to true and redeploy to bring them back; nothing else needs changing.
 * It lives in code rather than an env var because Hostinger's env API replaces
 * the whole set at once, so a code flag is the switch that can actually be
 * thrown here.
 */
export const COORDINATOR_DASHBOARD_ENABLED = false;

const norm = (s: string) => s.trim().toLowerCase();

function organiserEmails(): string[] {
  return (process.env.ORGANISER_EMAILS ?? "")
    .split(",")
    .map(norm)
    .filter(Boolean);
}

/**
 * Pure so it can be tested without a session. Never call with a
 * client-supplied address — only with the value from resolveEmail().
 */
export function roleForEmail(email: string | null): Role {
  if (!email) return { kind: "none" };
  const who = norm(email);

  if (organiserEmails().includes(who)) return { kind: "organiser" };

  const eventIds = events
    .filter((e) => (e.dashboardEmails ?? []).some((c) => norm(c) === who))
    .map((e) => eventId(e.name));

  if (eventIds.length === 0) return { kind: "none" };
  // Still staff, but holding no event while dashboards are off.
  return { kind: "coordinator", eventIds: COORDINATOR_DASHBOARD_ENABLED ? eventIds : [] };
}

/** Resolves from the session. The only role source any route may use. */
export async function resolveRole(): Promise<Role> {
  const { resolveEmail } = await import("@/lib/identity");
  return roleForEmail(await resolveEmail());
}

export function canViewEvent(role: Role, evId: string): boolean {
  if (role.kind === "organiser") return true;
  if (role.kind === "coordinator") return role.eventIds.includes(evId);
  return false;
}
