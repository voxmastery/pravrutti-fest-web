import "server-only";
import { events, eventId } from "@/lib/pravrutti-data";
import { applicationPath, listTeamMembers, readJsonByPath, teamMemberPath, teamPath } from "@/lib/blob-store";
import { resolveEmail } from "@/lib/identity";
import { sqlEnabled } from "@/lib/sql-store";
import { normalizeTeamCode, type Team, type TeamMember } from "@/lib/teams";
import type { Application } from "@/lib/applications";
import { resolveRole } from "@/lib/roles";
import {
  answerLabel,
  CERTIFICATE_QUESTIONS,
  parseCertificateAnswers,
  type CertificateAnswers,
} from "@/lib/certificate-questions";
import {
  decideCertificate,
  type CertificateApp,
  type CertificateMembership,
  type CertificateTeam,
  type LeadCheck,
} from "@/lib/certificate-eligibility";
import { feedbackStore, type FeedbackRow } from "@/lib/certificate-feedback";
import { contentDisposition } from "@/lib/certificate-layout";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

/**
 * Certificate reads. The only write on this path is one insert into
 * `certificate_feedback` (see lib/certificate-feedback.ts). Applications,
 * check-in stamps, and team records are loaded and left as they were.
 * The email is always the session — a body field cannot aim this at
 * somebody else, so a lead cannot print a teammate's certificate.
 */

type MemberRecord = {
  code?: string;
  member?: TeamMember;
  removedAt?: string;
};

const UNAVAILABLE = "Certificates aren't available right now.";

export async function certificateStatus(): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; eligible: boolean; submitted: boolean }
> {
  const email = await resolveEmail();
  if (!email) return { ok: false, status: 401, error: "Sign in to get your certificate." };
  if (!sqlEnabled()) return { ok: false, status: 503, error: UNAVAILABLE };

  const subject = await loadSubject(email);
  if (!subject.eligible) return { ok: true, eligible: false, submitted: false };
  const existing = await feedbackStore().get(email);
  return { ok: true, eligible: true, submitted: Boolean(existing) };
}

export async function submitCertificateFeedback(
  rawAnswers: unknown,
): Promise<{ ok: false; status: number; error: string } | { ok: true; already: boolean }> {
  const email = await resolveEmail();
  if (!email) return { ok: false, status: 401, error: "Sign in to get your certificate." };
  if (!sqlEnabled()) return { ok: false, status: 503, error: UNAVAILABLE };

  const subject = await loadSubject(email);
  if (!subject.eligible) {
    return { ok: false, status: 403, error: "Certificates are for participants who checked in." };
  }

  const parsed = parseCertificateAnswers(rawAnswers);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const saved = await feedbackStore().insertOnce({
    email,
    name: subject.name,
    answers: parsed.answers,
    submittedAt: new Date().toISOString(),
  });
  return { ok: true, already: !saved.created };
}

export async function downloadCertificate(): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; pdf: Uint8Array; filename: string; disposition: string }
> {
  const email = await resolveEmail();
  if (!email) return { ok: false, status: 401, error: "Sign in to get your certificate." };
  if (!sqlEnabled()) return { ok: false, status: 503, error: UNAVAILABLE };

  const subject = await loadSubject(email);
  if (!subject.eligible) {
    return { ok: false, status: 403, error: "Certificates are for participants who checked in." };
  }
  const existing = await feedbackStore().get(email);
  if (!existing) {
    return { ok: false, status: 409, error: "Answer the short questions first, then your certificate downloads." };
  }

  const rendered = await renderCertificatePdf(subject.name);
  return {
    ok: true,
    pdf: rendered.pdf,
    filename: rendered.filename,
    disposition: contentDisposition(rendered.filename),
  };
}

export async function certificateFeedbackExport(format: "json" | "csv"): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; format: "json"; rows: FeedbackRow[] }
  | { ok: true; format: "csv"; body: string; disposition: string }
> {
  const role = await resolveRole();
  if (role.kind !== "organiser" && role.kind !== "coordinator") {
    return { ok: false, status: 403, error: "This account can't view certificate feedback." };
  }
  if (!sqlEnabled()) return { ok: false, status: 503, error: UNAVAILABLE };
  const rows = await feedbackStore().list();
  if (format === "csv") {
    return {
      ok: true,
      format: "csv",
      body: feedbackCsv(rows),
      disposition: contentDisposition("Pravrutti2.0_Certificate_Feedback.csv"),
    };
  }
  return { ok: true, format: "json", rows };
}

async function loadSubject(email: string): Promise<{ eligible: false; name: null } | { eligible: true; name: string }> {
  const who = email.trim().toLowerCase();
  const ids = events.map((event) => eventId(event.name));
  const apps = await readApps(who, ids);
  const preliminary = decideCertificate({
    email: who,
    apps,
    memberships: [],
    teams: [],
    leadCheckedIn: [],
  });
  if (preliminary.eligible) return preliminary;

  const memberships = await readMemberships(who, ids);
  const links = teamLinks(apps, memberships);
  if (!links.length) return { eligible: false, name: null };

  const teams = await readTeams(links);
  const leadCheckedIn = await readLeadFlags(teams);
  return decideCertificate({ email: who, apps, memberships, teams, leadCheckedIn });
}

function teamLinks(apps: CertificateApp[], memberships: CertificateMembership[]) {
  const links: { eventId: string; code: string }[] = [];
  for (const member of memberships) {
    if (member.removed) continue;
    const code = normalizeTeamCode(member.code);
    if (code) links.push({ eventId: member.eventId, code });
  }
  for (const app of apps) {
    if (app.status !== "pending" && app.status !== "confirmed") continue;
    const code = normalizeTeamCode(app.teamCode ?? "");
    if (code) links.push({ eventId: app.eventId, code });
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.eventId}:${link.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readApps(email: string, ids: string[]): Promise<CertificateApp[]> {
  const apps: CertificateApp[] = [];
  for (const batch of chunks(ids, 12)) {
    const rows = await Promise.all(
      batch.map((id) => readJsonByPath(applicationPath(id, email)) as Promise<Application | null>),
    );
    for (const row of rows) {
      if (!row?.eventId || !row.email) continue;
      if (row.email.trim().toLowerCase() !== email) continue;
      apps.push({
        eventId: row.eventId,
        email: row.email,
        name: row.name ?? "",
        status: row.status,
        teamCode: row.teamCode ?? null,
        checkedInAt: row.checkedInAt ?? null,
      });
    }
  }
  return apps;
}

async function readMemberships(email: string, ids: string[]): Promise<CertificateMembership[]> {
  const memberships: CertificateMembership[] = [];
  for (const batch of chunks(ids, 12)) {
    const rows = await Promise.all(
      batch.map(async (id) => ({
        id,
        row: (await readJsonByPath(teamMemberPath(id, email))) as MemberRecord | null,
      })),
    );
    for (const { id, row } of rows) {
      if (!row) continue;
      const memberEmail = String(row.member?.email ?? email).trim().toLowerCase();
      if (memberEmail !== email) continue;
      memberships.push({
        eventId: id,
        code: String(row.code ?? ""),
        name: String(row.member?.name ?? ""),
        removed: Boolean(row.removedAt) || !normalizeTeamCode(row.code ?? ""),
      });
    }
  }
  return memberships;
}

async function readTeams(links: { eventId: string; code: string }[]): Promise<CertificateTeam[]> {
  const teams: CertificateTeam[] = [];
  for (const batch of chunks(links, 12)) {
    const rows = await Promise.all(
      batch.map(async (link) => ({
        link,
        team: (await readJsonByPath(teamPath(link.eventId, link.code))) as Team | null,
      })),
    );
    for (const { link, team } of rows) {
      teams.push({
        eventId: link.eventId,
        code: link.code,
        leadEmail: String(team?.createdByEmail ?? ""),
        gone: !team || Boolean(team.deletedAt) || Boolean(team.movedTo),
      });
    }
  }
  return teams;
}

/**
 * Check-in stamps for a live team.
 *
 * Any confirmed member still on the roster counts, not only the lead. A
 * cancelled or declined ticket does not, and a removed member is absent from
 * the roster. Deleted and moved teams are skipped before this runs.
 */
async function readLeadFlags(teams: CertificateTeam[]): Promise<LeadCheck[]> {
  const flags: LeadCheck[] = [];
  for (const team of teams) {
    if (team.gone) continue;
    const code = normalizeTeamCode(team.code);
    if (!code) continue;
    const roster = await listTeamMembers(team.eventId, code);
    const emails = new Set<string>();
    for (const member of roster) {
      const email = String(member?.email ?? "").trim().toLowerCase();
      if (email) emails.add(email);
    }
    const lead = team.leadEmail.trim().toLowerCase();
    if (lead) emails.add(lead);
    const rows = await Promise.all(
      [...emails].map(async (email) => {
        const app = (await readJsonByPath(applicationPath(team.eventId, email))) as Application | null;
        const sameEvent = app?.eventId === team.eventId;
        const confirmed = sameEvent && app?.status === "confirmed";
        return {
          eventId: team.eventId,
          email,
          code,
          status: app?.status,
          checkedIn: Boolean(confirmed && app?.checkedInAt),
        };
      }),
    );
    flags.push(...rows);
  }
  return flags;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function feedbackCsv(rows: FeedbackRow[]): string {
  const headers = ["Name", "Email", "Submitted", ...CERTIFICATE_QUESTIONS.map((q) => q.column)];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    const answers: CertificateAnswers = row.answers;
    lines.push(
      [
        row.name,
        row.email,
        row.submittedAt,
        ...CERTIFICATE_QUESTIONS.map((q) => (answers[q.id] ? answerLabel(q.id, answers[q.id]) : "")),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}
