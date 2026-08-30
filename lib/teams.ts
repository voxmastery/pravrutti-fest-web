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

/** Public confirm-this-is-the-right-team payload. No member PII. */
export type TeamPreview = {
  code: string;
  name: string;
  bio: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
};

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

/**
 * Pass `members` from listTeamMembers() — the team blob's own `members[]` is a
 * cache and can undercount after concurrent joins.
 */
export function toTeamPreview(team: Team, members?: TeamMember[]): TeamPreview {
  const roster = members ?? (Array.isArray(team.members) ? team.members : []);
  const memberCount = roster.length;
  return {
    code: team.code,
    name: team.name,
    bio: team.bio ?? "",
    memberCount,
    maxMembers: MAX_TEAM_SIZE,
    isFull: memberCount >= MAX_TEAM_SIZE,
  };
}
