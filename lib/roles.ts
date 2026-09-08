import { events, eventId } from "@/lib/pravrutti-data";

export type Role =
  | { kind: "organiser" }
  | { kind: "coordinator"; eventIds: string[] }
  | { kind: "none" };

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

  return eventIds.length > 0 ? { kind: "coordinator", eventIds } : { kind: "none" };
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
