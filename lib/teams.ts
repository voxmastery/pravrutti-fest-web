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
  /** Set when the lead added this person rather than them redeeming a code.
      They hold their place from that moment — the lead may register the team
      without waiting on them — so this records how they arrived, not a pending
      state that gates anything. */
  invitedAt?: string;
  /** Set when they followed their invite link. Until then they sit on the
      roster as "Invited" with no application of their own, and so no ticket. */
  acceptedAt?: string;
  /** Single-use secret carried by their invite link. Cleared once spent, so a
      forwarded link cannot be replayed after they have accepted. */
  inviteToken?: string;
};

/** Where a member stands. "invited" has no ticket yet; "joined" does. */
export type MemberStatus = "joined" | "invited";

/** Someone who redeemed a code was never invited, so they are joined outright. */
export function memberStatus(m: {
  invitedAt?: string;
  acceptedAt?: string;
} | null | undefined): MemberStatus {
  if (!m?.invitedAt) return "joined";
  return m.acceptedAt ? "joined" : "invited";
}

export type Team = {
  code: string;
  eventId: string;
  name: string;
  bio: string;
  createdByEmail: string;
  members: TeamMember[];
  createdAt: string;
  /** Set when the lead deletes the team. The store has no delete operation, so
      a deleted team is tombstoned and every reader treats it as absent. */
  deletedAt?: string;
  /** Where this team went when an organiser moved it to another event. */
  movedTo?: { eventId: string; code: string };
};

/** Name + email only. Phones stay on the team-member blob. */
export type TeamPerson = {
  name: string;
  email: string;
  /** Whether they have confirmed. Not PII, and the roster is unreadable
      without it — "who still hasn't accepted" is the lead's whole job here. */
  status: MemberStatus;
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
  /** Whether the person who asked leads this team. Only set where the viewer
      is known — the team-by-code lookup has no viewer and omits it. */
  isLead?: boolean;
  /** Whether a lead can still add somebody, i.e. registration is open. Set
      alongside isLead, so the ticket page can say why rather than offering a
      button the server would refuse. */
  canInvite?: boolean;
  /** The signed-in viewer is already on this team's list — the lead added
      them — so a full team still has their place. Without it, an invited
      teammate whose email bounced and who typed the code instead found their
      own team "full" and could not join it. */
  invited?: boolean;
  /** Who leads the team, for the team's own members. The roster is ordered
      by when people joined, and the first to join is not always the lead —
      a lead can be changed (see set_lead). Only sent where the roster is. */
  leadEmail?: string;
};

/** Strip phones and college before anything leaves the teams API. */
export function rosterPeople(members: TeamMember[]): TeamPerson[] {
  return members
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      email: String(m?.email ?? "").trim().toLowerCase(),
      status: memberStatus(m),
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
