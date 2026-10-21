import { cleanPersonName, normalizeTeamCode } from "@/lib/teams";

/**
 * Who may download a participation certificate.
 *
 * A person qualifies when their own ticket for any event is checked in, or
 * when they are still on a live team and any confirmed, non-removed member of
 * that same team in that same event is checked in. A cancelled or declined
 * member does not count, and neither does a deleted or moved team. The name
 * is always theirs — a checked-in registration first, otherwise the name on
 * their own application or team-member record. Nothing here reads a
 * caller-supplied name, and nobody else's application supplies the name.
 */

export type CertificateApp = {
  eventId: string;
  email: string;
  name: string;
  status: string;
  teamCode?: string | null;
  checkedInAt?: string | null;
};

export type CertificateMembership = {
  eventId: string;
  code: string;
  name: string;
  removed: boolean;
};

export type CertificateTeam = {
  eventId: string;
  code: string;
  leadEmail: string;
  /** Deleted, or moved to another event. Not a team someone can still be on. */
  gone: boolean;
};

export type LeadCheck = {
  eventId: string;
  email: string;
  checkedIn: boolean;
  /** Team this check-in belongs to. Absent only on older fixtures that name the lead. */
  code?: string;
  /** Application status. Absent counts as confirmed so existing fixtures stay valid. */
  status?: string;
  /** Taken off the roster. Their stamp does not qualify anyone. */
  removed?: boolean;
};

export type CertificateFacts = {
  email: string;
  apps: CertificateApp[];
  memberships: CertificateMembership[];
  teams: CertificateTeam[];
  leadCheckedIn: LeadCheck[];
};

export type CertificateDecision = { eligible: true; name: string } | { eligible: false; name: null };

const LIVE = new Set(["pending", "confirmed"]);

export function decideCertificate(facts: CertificateFacts): CertificateDecision {
  const who = facts.email.trim().toLowerCase();
  const apps = facts.apps.filter((a) => String(a.email ?? "").trim().toLowerCase() === who);

  const names: string[] = [];
  let eligible = false;

  const checked = apps
    .filter((a) => Boolean(a.checkedInAt))
    .sort((a, b) => String(b.checkedInAt).localeCompare(String(a.checkedInAt)));
  if (checked.length) {
    eligible = true;
    for (const app of checked) names.push(app.name);
  }

  const teams = new Map(
    facts.teams.map((t) => [`${t.eventId}:${normalizeTeamCode(t.code)}`, t] as const),
  );

  const links: { eventId: string; code: string; name: string }[] = [];
  for (const member of facts.memberships) {
    if (member.removed) continue;
    const code = normalizeTeamCode(member.code);
    if (!code) continue;
    links.push({ eventId: member.eventId, code, name: member.name });
  }
  for (const app of apps) {
    if (!LIVE.has(app.status)) continue;
    const code = normalizeTeamCode(app.teamCode ?? "");
    if (!code) continue;
    links.push({ eventId: app.eventId, code, name: app.name });
  }

  for (const link of links) {
    const team = teams.get(`${link.eventId}:${link.code}`);
    if (!team || team.gone) continue;
    if (!teamHasCheckIn(link.eventId, link.code, team.leadEmail, facts.leadCheckedIn)) continue;
    eligible = true;
    const own = apps.find((a) => a.eventId === link.eventId);
    if (own) names.push(own.name);
    names.push(link.name);
  }

  if (!eligible) return { eligible: false, name: null };
  const name = firstName(names);
  if (!name) return { eligible: false, name: null };
  return { eligible: true, name };
}

/** A confirmed teammate's stamp, on this team and this event, and still on the roster. */
function teamHasCheckIn(eventId: string, code: string, leadEmail: string, flags: LeadCheck[]): boolean {
  const normalized = normalizeTeamCode(code);
  const lead = leadEmail.trim().toLowerCase();
  return flags.some((flag) => {
    if (!flag.checkedIn || flag.removed) return false;
    if (flag.eventId !== eventId) return false;
    if (flag.status && flag.status !== "confirmed") return false;
    const flagCode = flag.code ? normalizeTeamCode(flag.code) : "";
    if (flagCode) return flagCode === normalized;
    return Boolean(lead) && flag.email.trim().toLowerCase() === lead;
  });
}

function firstName(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const name = cleanPersonName(candidate);
    if (name.length >= 2) return name;
  }
  return null;
}
