import { events, eventId } from "@/lib/pravrutti-data";
import { deskEmailsFor } from "@/lib/dashboard-access";

export type Role =
  | { kind: "organiser" }
  | { kind: "coordinator"; eventIds: string[] }
  | { kind: "registration" }
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
    .map((e) => eventId(e.name))
    .filter((slug) => deskEmailsFor(slug).includes(who));

  if (eventIds.length === 0) return { kind: "none" };
  /* Every event they are listed on. Whether each dashboard is actually open is
     a stored setting, applied by resolveRole() — this stays pure so it can be
     tested without a database. */
  return { kind: "coordinator", eventIds };
}

/**
 * Resolves from the session, with the stored access record applied. The only
 * role source any route may use.
 *
 * roleForEmail() alone answers "what do env and the event roster say"; this
 * adds the grants and switches an organiser has set from the dashboard.
 */
export async function resolveRole(): Promise<Role> {
  const { resolveEmail } = await import("@/lib/identity");
  return resolveRoleFor(await resolveEmail());
}

/** The same resolution for an address that is not the session's — used where a
    route has to judge somebody else, e.g. whether an applicant is staff. */
export async function resolveRoleFor(email: string | null): Promise<Role> {
  const [{ loadAccess }, { applyAccess }] = await Promise.all([
    import("@/lib/access-store"),
    import("@/lib/access-control"),
  ]);
  return applyAccess(roleForEmail(email), email, await loadAccess());
}

export function canViewEvent(role: Role, evId: string): boolean {
  if (role.kind === "organiser") return true;
  /* Desk volunteers check people in across the fest, same as organisers for
     scan/search/counts — they still cannot open gate, payments, or admin. */
  if (role.kind === "registration") return true;
  if (role.kind === "coordinator") return role.eventIds.includes(evId);
  return false;
}

/** FACULTY_EMAILS, for faculty who must not depend on the stored record. */
export function envFacultyEmails(): string[] {
  return (process.env.FACULTY_EMAILS ?? "")
    .split(",")
    .map(norm)
    .filter(Boolean);
}

/**
 * Whether the session may read the faculty board (every event's teams, with
 * contact details). Read-only by construction: it is not a Role, so no write
 * route's check can ever be satisfied by it.
 */
export async function resolveFacultyAccess(): Promise<{ email: string | null; allowed: boolean }> {
  const [{ resolveEmail }, { loadAccess }, { applyAccess, canViewFacultyBoard }] = await Promise.all([
    import("@/lib/identity"),
    import("@/lib/access-store"),
    import("@/lib/access-control"),
  ]);
  const email = await resolveEmail();
  const access = await loadAccess();
  const role = applyAccess(roleForEmail(email), email, access);
  return { email, allowed: canViewFacultyBoard(role, email, access, envFacultyEmails()) };
}
