import "server-only";
import { listAll, putJson, readJsonByPath, readPrivate, deleteJson } from "@/lib/blob-store";
import { resolveDisplayName } from "@/lib/identity";
import { loadViewerFacts } from "@/lib/track-pick-service";
import {
  DOCS_COPY,
  HACKTIVATE_DEMO_PREFIX,
  hacktivateDemoPath,
  validateDriveUrl,
  type HacktivateDemoLink,
} from "@/lib/hacktivate-docs";

export type ParticipantDemoState = {
  canSubmit: boolean;
  message: string | null;
  team: { code: string; name: string; status: string } | null;
  demo: HacktivateDemoLink | null;
};

async function listDemos(): Promise<HacktivateDemoLink[]> {
  const listed = await listAll(HACKTIVATE_DEMO_PREFIX);
  const out: HacktivateDemoLink[] = [];
  for (const item of listed) {
    const url = "url" in item ? String(item.url) : "";
    const path = "pathname" in item && item.pathname ? String(item.pathname) : "";
    const raw = path
      ? await readJsonByPath(path)
      : url
        ? await readPrivate(url)
        : null;
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as HacktivateDemoLink;
    if (!rec.teamCode || !rec.driveUrl) continue;
    out.push(rec);
  }
  out.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return out;
}

export async function getParticipantDemo(email: string): Promise<ParticipantDemoState> {
  const facts = await loadViewerFacts(email);
  if (!facts.team) {
    return { canSubmit: false, message: DOCS_COPY.noTeam, team: null, demo: null };
  }
  const confirmed = facts.team.status === "confirmed" && facts.viewerLive;
  const demo = (await readJsonByPath(hacktivateDemoPath(facts.team.code))) as HacktivateDemoLink | null;
  return {
    canSubmit: confirmed,
    message: confirmed ? null : DOCS_COPY.notConfirmed,
    team: { code: facts.team.code, name: facts.team.name, status: facts.team.status },
    demo: demo?.driveUrl ? demo : null,
  };
}

export type SubmitResult =
  | { ok: true; demo: HacktivateDemoLink; state: ParticipantDemoState }
  | { ok: false; status: number; code: string; message: string; state: ParticipantDemoState };

export async function submitDemoLink(email: string, rawUrl: string): Promise<SubmitResult> {
  const state = () => getParticipantDemo(email);
  const facts = await loadViewerFacts(email);
  if (!facts.team) {
    return { ok: false, status: 403, code: "no_team", message: DOCS_COPY.noTeam, state: await state() };
  }
  if (facts.team.status !== "confirmed" || !facts.viewerLive) {
    return {
      ok: false,
      status: 403,
      code: "not_confirmed",
      message: DOCS_COPY.notConfirmed,
      state: await state(),
    };
  }

  const validated = validateDriveUrl(rawUrl);
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      code: validated.code,
      message: validated.message,
      state: await state(),
    };
  }

  const displayName = (await resolveDisplayName())?.trim() || email;
  const record: HacktivateDemoLink = {
    teamCode: facts.team.code,
    teamName: facts.team.name,
    driveUrl: validated.driveUrl,
    submittedByEmail: email.trim().toLowerCase(),
    submittedByName: displayName,
    submittedAt: new Date().toISOString(),
  };

  await putJson(hacktivateDemoPath(facts.team.code), record, true);
  const next = await state();
  return { ok: true, demo: record, state: next };
}

export type ClearResult =
  | { ok: true; state: ParticipantDemoState }
  | { ok: false; status: number; code: string; message: string; state: ParticipantDemoState };

export async function clearDemoLink(email: string): Promise<ClearResult> {
  const state = () => getParticipantDemo(email);
  const facts = await loadViewerFacts(email);
  if (!facts.team) {
    return { ok: false, status: 403, code: "no_team", message: DOCS_COPY.noTeam, state: await state() };
  }
  if (facts.team.status !== "confirmed" || !facts.viewerLive) {
    return {
      ok: false,
      status: 403,
      code: "not_confirmed",
      message: DOCS_COPY.notConfirmed,
      state: await state(),
    };
  }

  const path = hacktivateDemoPath(facts.team.code);
  const existing = (await readJsonByPath(path)) as HacktivateDemoLink | null;
  if (!existing?.driveUrl) {
    return { ok: false, status: 404, code: "not_found", message: DOCS_COPY.notFound, state: await state() };
  }

  await deleteJson(path);
  return { ok: true, state: await state() };
}

export type StaffDemoBoard = {
  total: number;
  demos: HacktivateDemoLink[];
};

export async function getStaffDemoBoard(): Promise<StaffDemoBoard> {
  const demos = await listDemos();
  return { total: demos.length, demos };
}
