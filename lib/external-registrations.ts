import "server-only";
import { COVERED_BY_LEAD, type Application } from "@/lib/applications";
import { applicationPath, putJson, readJsonByPath, teamMemberPath, teamPath } from "@/lib/blob-store";
import { resendConfirmation } from "@/lib/payment-review";
import { generateTeamCode } from "@/lib/team-code";
import type { Team, TeamMember } from "@/lib/teams";
import { newTicketId } from "@/lib/ticket-id";

/**
 * Registrations taken somewhere else, made into ours.
 *
 * Some events also took entries through Unstop, which collected the fee
 * itself. Those students existed nowhere on our side — not in an event's
 * count, not on the desk at check-in, not on /ticket — so an organiser
 * imports Unstop's export and each entry becomes an ordinary confirmed
 * registration. Two things mark where it came from: `source`, and a payment
 * reference naming the Unstop registration the money went through.
 *
 * Rows sharing an Unstop team ID are one team, as on Unstop: one fee, paid
 * by the leader, the rest covered by them — and a real team, with a code,
 * a record and a roster, so it counts as one team and every member's ticket
 * page shows it. Imported row by row, CHAOS's eight teams of four became 31
 * solo entrants and Rs. 6,200 where Rs. 1,600 was paid.
 */

export const EXTERNAL_SOURCES = ["unstop"] as const;
export type ExternalSource = (typeof EXTERNAL_SOURCES)[number];

export type ExternalEntry = {
  externalId?: string;
  teamName?: string | null;
  /** "lead" for Unstop's Team Leader; anything else is a member. */
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  college?: string;
  registeredAt?: string;
};

type EventInfo = { id: string; name: string; fee: string; free: boolean };
type Placement = { code: string; name: string; lead: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Indian mobiles as the desk stores them: ten digits, no +91. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^\d{10}$/.test(local) ? local : null;
}

/** Unstop names a solo entrant's team after their username — the part of
    their address before the @ — which is not a team name anyone chose. */
function realTeamName(teamName: string | null | undefined, email: string): string | null {
  const t = String(teamName ?? "").trim();
  if (!t || t.toLowerCase() === email.split("@")[0]) return null;
  return t;
}

export function buildExternalApplication(args: {
  entry: ExternalEntry;
  source: ExternalSource;
  event: EventInfo;
  by: string;
  at: string;
  /** Where they stand on an imported team; absent for a solo entrant. */
  team?: Placement;
}): { application: Application } | { error: string } {
  const { entry, source, event, by, at, team } = args;
  const email = String(entry.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "No readable email address." };
  const name = String(entry.name ?? "").trim();
  if (!name) return { error: "No name." };
  const phone = normalizePhone(String(entry.phone ?? ""));
  if (!phone) return { error: "No readable 10-digit mobile number." };
  const externalId = String(entry.externalId ?? "").trim();
  if (!externalId) return { error: `No ${source} registration ID.` };

  /* The fee is the team's, and the leader paid it; a free event has none. */
  const pays = !event.free && (!team || team.lead);
  const registered = Date.parse(String(entry.registeredAt ?? ""));
  const application: Application = {
    ticketId: newTicketId(),
    eventId: event.id,
    eventName: event.name,
    status: "confirmed",
    payment: pays ? "paid" : "not_required",
    fee: event.free ? "Free" : pays ? event.fee : COVERED_BY_LEAD,
    name,
    email,
    phone,
    college: String(entry.college ?? "").trim(),
    teamName: team ? team.name : realTeamName(entry.teamName, email),
    teamCode: team ? team.code : null,
    members: null,
    appliedAt: Number.isFinite(registered) ? new Date(registered).toISOString() : at,
    decidedAt: at,
    paymentRef: pays ? `${source.toUpperCase()}-${externalId}` : null,
    ...(pays ? { paymentVerifiedAt: at, paymentVerifiedBy: by } : {}),
    source,
    externalId,
  };
  return { application };
}

export type ImportResult = {
  imported: { email: string; name: string; ticketId: string; mailed: boolean }[];
  skipped: { email: string; reason: string }[];
};

const emailOf = (e: ExternalEntry) => String(e?.email ?? "").trim().toLowerCase();

/** Rows in the order given, grouped by registration ID: Unstop lists a
    team's members as separate rows sharing one Team ID. */
function groupByRegistration(entries: readonly ExternalEntry[]): ExternalEntry[][] {
  const groups = new Map<string, ExternalEntry[]>();
  entries.forEach((e, i) => {
    const id = String(e?.externalId ?? "").trim() || `row-${i}`;
    groups.set(id, [...(groups.get(id) ?? []), e]);
  });
  return [...groups.values()];
}

/** Why this group cannot come in whole, or null. Someone already registered
    here, or already on a team here, would split the team in two. */
async function blockerFor(eventId: string, group: readonly ExternalEntry[]): Promise<string | null> {
  for (const e of group) {
    const email = emailOf(e);
    if (!email) continue;
    if (await readJsonByPath(applicationPath(eventId, email)))
      return `${email} is already registered for this event`;
    if (group.length > 1 && (await readJsonByPath(teamMemberPath(eventId, email))))
      return `${email} is already on a team for this event`;
  }
  return null;
}

export async function importExternal(args: {
  entries: readonly ExternalEntry[];
  source: ExternalSource;
  event: EventInfo;
  by: string;
}): Promise<ImportResult> {
  const { source, event, by } = args;
  const at = new Date().toISOString();
  const result: ImportResult = { imported: [], skipped: [] };

  for (const group of groupByRegistration(args.entries)) {
    const blocked = await blockerFor(event.id, group);
    if (blocked) {
      for (const e of group)
        result.skipped.push({ email: emailOf(e), reason: `Left as it is: ${blocked}.` });
      continue;
    }

    const isTeam = group.length > 1;
    const leadIndex = Math.max(0, group.findIndex((e) => String(e.role ?? "").toLowerCase() === "lead"));
    const code = isTeam ? generateTeamCode() : "";
    const teamName = String(group[0].teamName ?? "").trim() || `Team ${group[0].externalId}`;

    const built = group.map((entry, i) =>
      buildExternalApplication({
        entry, source, event, by, at,
        team: isTeam ? { code, name: teamName, lead: i === leadIndex } : undefined,
      }),
    );
    /* A team comes in whole or not at all — a member we cannot read would
       leave the rest one short with nobody told. */
    const unreadable = built.findIndex((b) => "error" in b);
    if (unreadable !== -1) {
      const why = (built[unreadable] as { error: string }).error;
      if (!isTeam) result.skipped.push({ email: emailOf(group[0]), reason: why });
      else
        for (const e of group)
          result.skipped.push({ email: emailOf(e), reason: `Team left out — ${emailOf(group[unreadable]) || "a member"}: ${why}` });
      continue;
    }
    const apps = built.map((b) => (b as { application: Application }).application);

    if (isTeam) {
      const lead = apps[leadIndex];
      const team: Team = {
        code, eventId: event.id, name: teamName, bio: "",
        createdByEmail: lead.email, members: [], createdAt: lead.appliedAt,
      };
      await putJson(teamPath(event.id, code), team, false);
      for (const a of apps) {
        const member: TeamMember = { name: a.name, email: a.email, phone: a.phone, college: a.college, joinedAt: a.appliedAt };
        await putJson(teamMemberPath(event.id, a.email), { code, eventId: event.id, member }, false);
      }
    }

    for (const a of apps) {
      try {
        await putJson(applicationPath(event.id, a.email), a, false);
      } catch {
        result.skipped.push({ email: a.email, reason: "Already registered for this event — left as it is." });
        continue;
      }
      const sent = await resendConfirmation({ eventId: event.id, email: a.email });
      result.imported.push({ email: a.email, name: a.name, ticketId: a.ticketId, mailed: !!sent?.mail?.sent });
    }
  }
  return result;
}
