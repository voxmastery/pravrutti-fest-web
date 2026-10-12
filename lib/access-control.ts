import type { Role } from "@/lib/roles";

/**
 * Who may see what, as data an organiser can change from the dashboard.
 *
 * Kept out of code and out of env on purpose. Env could not be edited without
 * the hosting panel (Hostinger replaces the whole set at once and masks it
 * back), and code would put "who can verify payments" in reach of anyone with
 * repo access. Stored, it carries who granted it and when — the thing neither
 * of the other two could give.
 *
 * The rules below are pure so they can be tested without a database; reading
 * and writing the record lives in lib/access-store.ts.
 */

export type OrganiserGrant = {
  email: string;
  /** Organiser who granted it — a decision about privilege needs a name. */
  addedBy: string;
  addedAt: string;
};

export type AccessConfig = {
  /** Granted from the dashboard, on top of ORGANISER_EMAILS. */
  organisers: OrganiserGrant[];
  /** Master switch for every coordinator dashboard. */
  coordinatorsEnabled: boolean;
  /** Event ids switched off individually, applied when the master is on. */
  coordinatorsDisabledEventIds: string[];
  /** Faculty who may READ every event's teams and participants on /faculty.
      Deliberately not a Role: it grants no write anywhere, so no existing
      route's permission check has to learn about it. */
  faculty: OrganiserGrant[];
  /** Registration-desk volunteers — check-in scanner + search only (/desk). */
  registration: OrganiserGrant[];
};

/**
 * Coordinator dashboards start switched off, matching the state the site is
 * already in, so deploying this feature changes nothing until someone acts.
 */
export const DEFAULT_ACCESS: AccessConfig = {
  organisers: [],
  coordinatorsEnabled: false,
  coordinatorsDisabledEventIds: [],
  faculty: [],
  registration: [],
};

export const normEmail = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Same shape the register form demands, so one address cannot pass here and
    fail there. Deliberately rejects the separators that a pasted list brings. */
export function isValidEmail(raw: unknown): boolean {
  const email = normEmail(raw);
  if (!email || email.length > 120) return false;
  if (/[,;|\s]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function readGrants(raw: unknown): OrganiserGrant[] {
  return Array.isArray(raw)
    ? raw
        .filter((g): g is OrganiserGrant => !!g && isValidEmail((g as OrganiserGrant).email))
        .map((g) => ({ email: normEmail(g.email), addedBy: String(g.addedBy ?? ""), addedAt: String(g.addedAt ?? "") }))
    : [];
}

/** Tolerates a half-written or older record rather than throwing on it. */
export function readAccess(raw: unknown): AccessConfig {
  const r = (raw ?? {}) as Partial<AccessConfig>;
  return {
    organisers: readGrants(r.organisers),
    coordinatorsEnabled: r.coordinatorsEnabled === true,
    coordinatorsDisabledEventIds: Array.isArray(r.coordinatorsDisabledEventIds)
      ? r.coordinatorsDisabledEventIds.map((s) => String(s)).filter(Boolean)
      : [],
    faculty: readGrants(r.faculty),
    registration: readGrants(r.registration),
  };
}

/**
 * May this address read the faculty board? Organisers can, since they already
 * see everything; faculty are the stored grants plus FACULTY_EMAILS. Pure: the
 * caller passes the resolved role and the env list.
 */
export function canViewFacultyBoard(
  role: Role,
  email: string | null,
  access: AccessConfig,
  envFaculty: string[] = []
): boolean {
  if (role.kind === "organiser") return true;
  const who = normEmail(email);
  if (!who) return false;
  return envFaculty.map(normEmail).includes(who) || access.faculty.some((g) => g.email === who);
}

/** Is this event's coordinator dashboard on, given the config? */
export function coordinatorDashboardOn(access: AccessConfig, evId: string): boolean {
  if (!access.coordinatorsEnabled) return false;
  return !access.coordinatorsDisabledEventIds.includes(evId);
}

/**
 * The role a person actually holds, once stored grants are applied.
 *
 * A stored grant can only ever ADD rights; it never takes away what env or the
 * event roster already gave, so a bad write cannot lock anyone out. Registration
 * is the lowest staff tier — it never demotes an organiser or coordinator.
 */
export function applyAccess(base: Role, email: string | null, access: AccessConfig): Role {
  if (base.kind === "organiser") return base;

  const who = normEmail(email);
  if (who && access.organisers.some((g) => g.email === who)) return { kind: "organiser" };

  if (base.kind === "coordinator")
    return { kind: "coordinator", eventIds: base.eventIds.filter((id) => coordinatorDashboardOn(access, id)) };

  if (who && access.registration.some((g) => g.email === who)) return { kind: "registration" };

  return base;
}

export type AccessAction =
  | { type: "add_organiser"; email: string }
  | { type: "remove_organiser"; email: string }
  | { type: "set_coordinators"; enabled: boolean }
  | { type: "set_event_coordinator"; eventId: string; enabled: boolean }
  | { type: "add_faculty"; email: string }
  | { type: "remove_faculty"; email: string }
  | { type: "add_registration"; email: string }
  | { type: "remove_registration"; email: string };

export type ActionResult = { access: AccessConfig } | { error: string };

/**
 * Applies one change. Pure: the caller persists whatever comes back.
 *
 * `by` is the organiser making the change and is recorded on a grant. Removing
 * only ever touches stored grants — an organiser who is in ORGANISER_EMAILS
 * cannot be removed from here, which is what stops the dashboard being used to
 * lock every organiser out of it.
 */
export function applyAction(access: AccessConfig, action: AccessAction, by: string): ActionResult {
  switch (action.type) {
    case "add_organiser": {
      const email = normEmail(action.email);
      if (!isValidEmail(email)) return { error: "Enter a valid email address." };
      if (access.organisers.some((g) => g.email === email))
        return { error: "That address is already an organiser." };
      return {
        access: {
          ...access,
          organisers: [...access.organisers, { email, addedBy: normEmail(by), addedAt: new Date().toISOString() }],
        },
      };
    }
    case "remove_organiser": {
      const email = normEmail(action.email);
      if (!access.organisers.some((g) => g.email === email))
        return { error: "That organiser was granted outside the dashboard and cannot be removed here." };
      return { access: { ...access, organisers: access.organisers.filter((g) => g.email !== email) } };
    }
    case "set_coordinators":
      return { access: { ...access, coordinatorsEnabled: action.enabled === true } };
    case "set_event_coordinator": {
      const evId = String(action.eventId ?? "").trim();
      if (!evId) return { error: "Missing event." };
      const without = access.coordinatorsDisabledEventIds.filter((id) => id !== evId);
      return {
        access: {
          ...access,
          coordinatorsDisabledEventIds: action.enabled ? without : [...without, evId],
        },
      };
    }
    case "add_faculty": {
      const email = normEmail(action.email);
      if (!isValidEmail(email)) return { error: "Enter a valid email address." };
      if (access.faculty.some((g) => g.email === email)) return { error: "That address already has faculty access." };
      return {
        access: {
          ...access,
          faculty: [...access.faculty, { email, addedBy: normEmail(by), addedAt: new Date().toISOString() }],
        },
      };
    }
    case "remove_faculty": {
      const email = normEmail(action.email);
      if (!access.faculty.some((g) => g.email === email))
        return { error: "That address was granted outside the dashboard and cannot be removed here." };
      return { access: { ...access, faculty: access.faculty.filter((g) => g.email !== email) } };
    }
    case "add_registration": {
      const email = normEmail(action.email);
      if (!isValidEmail(email)) return { error: "Enter a valid email address." };
      if (access.registration.some((g) => g.email === email))
        return { error: "That address already has registration-desk access." };
      return {
        access: {
          ...access,
          registration: [
            ...access.registration,
            { email, addedBy: normEmail(by), addedAt: new Date().toISOString() },
          ],
        },
      };
    }
    case "remove_registration": {
      const email = normEmail(action.email);
      if (!access.registration.some((g) => g.email === email))
        return { error: "That address does not have registration-desk access." };
      return {
        access: { ...access, registration: access.registration.filter((g) => g.email !== email) },
      };
    }
    default:
      return { error: "Unknown action." };
  }
}
