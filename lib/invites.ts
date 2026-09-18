import { randomBytes } from "crypto";
import { TeamMember } from "@/lib/teams";
import { isValidPhone, normalizePhone } from "@/lib/applications";

/**
 * Team invitations.
 *
 * The lead builds the roster themselves — name, email, phone per person — and
 * each added member gets a link that confirms they are really on the team.
 *
 * The important thing this file encodes is that **an invite is not a gate**.
 * A member counts toward the roster from the moment the lead adds them, so the
 * lead can register without waiting on anybody. Accepting is what earns that
 * member their own application and ticket; until then they are on the team but
 * have nothing to show at the desk. Everything here is pure so the rules can be
 * tested without a store or a mailbox.
 */

/** Bytes of randomness behind an invite link. 32 bytes = 64 hex characters. */
const TOKEN_BYTES = 32;

/** Invite links are the only proof of identity in the accept flow, so the
    token has to be unguessable on its own — there is no password behind it. */
export function newInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Shape a token must have before we bother hitting the store with it. */
export function isValidInviteToken(raw: unknown): boolean {
  return /^[a-f0-9]{64}$/.test(String(raw ?? "").trim().toLowerCase());
}

export function readInviteToken(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** The pointer record stored at invite/<token>.json. */
export type InvitePointer = {
  token: string;
  eventId: string;
  code: string;
  email: string;
  createdAt: string;
  /** Set when the token is spent or the member leaves — a dead link. */
  usedAt?: string;
};

export const INVITE_NAME_MIN = 2;
export const INVITE_NAME_MAX = 80;

export const INVITE_EMAIL_HINT = "Enter a valid email address for your teammate.";
export const INVITE_NAME_HINT = "Enter your teammate's full name.";

export function normalizeMemberEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().slice(0, 120);
}

export function isValidMemberEmail(raw: unknown): boolean {
  const email = normalizeMemberEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;
}

export type AddMemberInput = {
  name: unknown;
  email: unknown;
  phone: unknown;
};

export type AddMemberFields = {
  name: string;
  email: string;
  phone: string;
};

/**
 * Validate what the lead typed into the "add a member" form.
 *
 * The lead is entering somebody else's details from memory or a WhatsApp
 * message, so a typo here means an invite that silently goes nowhere. The
 * checks are the same ones the member would have faced registering themselves.
 */
export function readAddMember(input: AddMemberInput): { fields: AddMemberFields } | { error: string } {
  const name = String(input?.name ?? "").trim().slice(0, INVITE_NAME_MAX);
  if (name.length < INVITE_NAME_MIN) return { error: INVITE_NAME_HINT };

  if (!isValidMemberEmail(input?.email)) return { error: INVITE_EMAIL_HINT };
  const email = normalizeMemberEmail(input?.email);

  const phone = normalizePhone(input?.phone);
  if (!isValidPhone(phone))
    return { error: `Enter a 10-digit mobile number for ${name}, starting with 6-9.` };

  return { fields: { name, email, phone } };
}

/** Why an add was refused, in words a lead can act on. */
export type AddRefusal =
  | { ok: false; reason: "full"; message: string }
  | { ok: false; reason: "duplicate"; message: string };

export type AddDecision = { ok: true } | AddRefusal;

/**
 * May this person be added to this roster?
 *
 * Capacity counts everyone already on the team, invited or accepted alike —
 * an unaccepted invite still occupies a place, otherwise a lead could invite
 * twelve people for a team of four and let the race decide.
 */
export function canAddMember(args: {
  roster: Pick<TeamMember, "email">[];
  maxMembers: number;
  email: string;
}): AddDecision {
  const email = normalizeMemberEmail(args.email);
  const roster = Array.isArray(args.roster) ? args.roster : [];

  if (roster.some((m) => normalizeMemberEmail(m?.email) === email))
    return { ok: false, reason: "duplicate", message: "That email is already on this team." };

  const cap = Math.max(1, Math.floor(args.maxMembers));
  if (roster.length >= cap)
    return {
      ok: false,
      reason: "full",
      message: `This team is full — ${cap} ${cap === 1 ? "person" : "people"} including you.`,
    };

  return { ok: true };
}

/** Build the roster entry for someone the lead just added. */
export function invitedMember(args: {
  fields: AddMemberFields;
  college: string;
  token: string;
  now?: string;
}): TeamMember {
  const at = args.now ?? new Date().toISOString();
  return {
    name: args.fields.name,
    email: args.fields.email,
    phone: args.fields.phone,
    /* Inherited from the lead: the member never typed it, and asking them for
       it at accept time would turn a one-click confirmation into a form. */
    college: String(args.college ?? "").trim().slice(0, 120),
    joinedAt: at,
    invitedAt: at,
    inviteToken: args.token,
  };
}

/** Why accepting failed. Every case is a dead link from the member's side. */
export type AcceptFailure = "bad-token" | "unknown" | "spent" | "team-gone";

export type AcceptOutcome =
  | { ok: true; member: TeamMember; alreadyAccepted: boolean }
  | { ok: false; reason: AcceptFailure };

/**
 * Decide what one click of an invite link means.
 *
 * Re-clicking a link you already used is not an error — people do it from a
 * second device, or after losing the tab — so an already-accepted member is
 * waved through to their team page rather than shown a failure.
 */
export function decideAccept(args: {
  pointer: InvitePointer | null;
  member: TeamMember | null;
  teamExists: boolean;
}): AcceptOutcome {
  if (!args.pointer) return { ok: false, reason: "unknown" };
  if (!args.teamExists) return { ok: false, reason: "team-gone" };
  if (!args.member) return { ok: false, reason: "unknown" };

  if (args.member.acceptedAt) return { ok: true, member: args.member, alreadyAccepted: true };

  /* The pointer was spent but the member never accepted: they left the team,
     or the lead removed them. The place is gone, so the link is too. */
  if (args.pointer.usedAt) return { ok: false, reason: "spent" };

  return { ok: true, member: args.member, alreadyAccepted: false };
}

/** The accepted form of a member — token burned so the link cannot be reused. */
export function acceptedMember(member: TeamMember, now?: string): TeamMember {
  const { inviteToken: _spent, ...rest } = member;
  return { ...rest, acceptedAt: member.acceptedAt ?? now ?? new Date().toISOString() };
}

/** Public copy for an invite email. Kept here so the wording is testable. */
export function inviteSubject(args: { eventName: string; teamName: string }): string {
  return `${args.teamName} added you for ${args.eventName} — Pravrutti 2026`;
}
