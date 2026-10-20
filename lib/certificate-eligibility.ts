import { cleanPersonName, normalizeTeamCode } from "@/lib/teams";

/**
 * Who may download a participation certificate.
 *
 * A person qualifies when their own ticket for any event is checked in, or
 * when they are still on a team whose lead is checked in for that same event.
 * The name is always theirs — a checked-in registration first, otherwise the
 * name on their own application or team-member record. Nothing here reads a
 * caller-supplied name, and a lead's facts never include a teammate's.
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
  const leadIn = new Set(
    facts.leadCheckedIn
      .filter((l) => l.checkedIn)
      .map((l) => `${l.eventId}:${l.email.trim().toLowerCase()}`),
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
    const lead = team.leadEmail.trim().toLowerCase();
    if (!lead || !leadIn.has(`${link.eventId}:${lead}`)) continue;
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

function firstName(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const name = cleanPersonName(candidate);
    if (name.length >= 2) return name;
  }
  return null;
}
