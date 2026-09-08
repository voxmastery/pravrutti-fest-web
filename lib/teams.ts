import { MAX_TEAM_SIZE } from "@/lib/applications";

/** New teams mint 12-char codes — unique enough that collisions aren't a practical risk. */
export const TEAM_CODE_LENGTH = 12;
/** Older 6-char codes still verify/join so existing teams keep working. */
export const TEAM_CODE_LENGTH_MIN = 6;
export const MAX_TEAM_BIO = 240;

export type TeamMember = {
  name: string;
  email: string;
  phone: string;
  college: string;
  joinedAt: string;
};

export type Team = {
  code: string;
  eventId: string;
  name: string;
  bio: string;
  createdByEmail: string;
  members: TeamMember[];
  createdAt: string;
};

/** Name + email only. Phones stay on the team-member blob. */
export type TeamPerson = {
  name: string;
  email: string;
};

/** Public confirm-this-is-the-right-team payload. No member PII unless
    `members` is set — that field is mine/create only, never verify-by-code. */
export type TeamPreview = {
  code: string;
  name: string;
  bio: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
  members?: TeamPerson[];
};

/** Strip phones and college before anything leaves the teams API. */
export function rosterPeople(members: TeamMember[]): TeamPerson[] {
  return members
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      email: String(m?.email ?? "").trim().toLowerCase(),
    }))
    .filter((p) => p.name.length >= 2 && p.email.includes("@"));
}

export function normalizeTeamCode(raw: string) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TEAM_CODE_LENGTH);
}

export function isValidTeamCode(code: string) {
  const n = normalizeTeamCode(code);
  return n.length >= TEAM_CODE_LENGTH_MIN && n.length <= TEAM_CODE_LENGTH;
}

/** Cap for this event, including the lead. Falls back to the global 4. */
export function maxTeamSizeFor(event: { teamSize?: { max?: number } } | null | undefined) {
  const max = Number(event?.teamSize?.max);
  if (!Number.isFinite(max) || max < 1) return MAX_TEAM_SIZE;
  return Math.floor(max);
}

/**
 * Pass `members` from listTeamMembers() — the team blob's own `members[]` is a
 * cache and can undercount after concurrent joins.
 */
export function toTeamPreview(
  team: Team,
  members?: TeamMember[],
  maxMembers: number = MAX_TEAM_SIZE,
  includeRoster = false,
): TeamPreview {
  const roster = members ?? (Array.isArray(team.members) ? team.members : []);
  const memberCount = roster.length;
  const cap = Math.max(1, maxMembers);
  return {
    code: team.code,
    name: team.name,
    bio: team.bio ?? "",
    memberCount,
    maxMembers: cap,
    isFull: memberCount >= cap,
    ...(includeRoster ? { members: rosterPeople(roster) } : {}),
  };
}
