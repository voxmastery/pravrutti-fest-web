import "server-only";
import {
  listAll,
  putJson,
  readJsonByPath,
  readPrivate,
  deleteJson,
} from "@/lib/blob-store";
import { resolveDisplayName } from "@/lib/identity";
import { loadViewerFacts } from "@/lib/track-pick-service";
import {
  DOCS_COPY,
  HACKTIVATE_DOC_MAX_BYTES,
  HACKTIVATE_DOC_MAX_PER_TEAM,
  HACKTIVATE_DOC_PREFIX,
  hacktivateDocPath,
  hacktivateDocTeamPrefix,
  metaOf,
  type HacktivateDocMeta,
  type HacktivateDocRecord,
} from "@/lib/hacktivate-docs";
import { newDocId, validatePdfUpload } from "@/lib/hacktivate-docs-node";

export type ParticipantDocsState = {
  canUpload: boolean;
  message: string | null;
  team: { code: string; name: string; status: string } | null;
  docs: HacktivateDocMeta[];
  maxPerTeam: number;
  maxBytes: number;
};

async function listRecords(prefix: string): Promise<HacktivateDocRecord[]> {
  const listed = await listAll(prefix);
  const out: HacktivateDocRecord[] = [];
  for (const item of listed) {
    const url = "url" in item ? String(item.url) : "";
    const path = "pathname" in item && item.pathname ? String(item.pathname) : "";
    const raw = path
      ? await readJsonByPath(path)
      : url
        ? await readPrivate(url)
        : null;
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as HacktivateDocRecord;
    if (!rec.id || !rec.contentBase64 || !rec.teamCode) continue;
    out.push(rec);
  }
  out.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return out;
}

export async function getParticipantDocs(email: string): Promise<ParticipantDocsState> {
  const facts = await loadViewerFacts(email);
  if (!facts.team) {
    return {
      canUpload: false,
      message: DOCS_COPY.noTeam,
      team: null,
      docs: [],
      maxPerTeam: HACKTIVATE_DOC_MAX_PER_TEAM,
      maxBytes: HACKTIVATE_DOC_MAX_BYTES,
    };
  }
  const confirmed = facts.team.status === "confirmed" && facts.viewerLive;
  const records = await listRecords(hacktivateDocTeamPrefix(facts.team.code));
  return {
    canUpload: confirmed,
    message: confirmed ? null : DOCS_COPY.notConfirmed,
    team: { code: facts.team.code, name: facts.team.name, status: facts.team.status },
    docs: records.map(metaOf),
    maxPerTeam: HACKTIVATE_DOC_MAX_PER_TEAM,
    maxBytes: HACKTIVATE_DOC_MAX_BYTES,
  };
}

export type UploadResult =
  | { ok: true; doc: HacktivateDocMeta; state: ParticipantDocsState }
  | { ok: false; status: number; code: string; message: string; state: ParticipantDocsState };

export async function uploadParticipantPdf(
  email: string,
  opts: { fileName: string; bytes: Buffer },
): Promise<UploadResult> {
  const state = () => getParticipantDocs(email);
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

  const validated = validatePdfUpload(opts);
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      code: validated.code,
      message: validated.message,
      state: await state(),
    };
  }

  const existing = await listRecords(hacktivateDocTeamPrefix(facts.team.code));
  if (existing.length >= HACKTIVATE_DOC_MAX_PER_TEAM) {
    return {
      ok: false,
      status: 409,
      code: "team_full",
      message: DOCS_COPY.teamFull,
      state: await state(),
    };
  }

  const id = newDocId();
  const displayName = (await resolveDisplayName())?.trim() || email;
  const record: HacktivateDocRecord = {
    id,
    teamCode: facts.team.code,
    teamName: facts.team.name,
    fileName: validated.fileName,
    size: validated.size,
    uploadedByEmail: email.trim().toLowerCase(),
    uploadedByName: displayName,
    uploadedAt: new Date().toISOString(),
    contentBase64: validated.contentBase64,
    mimeType: "application/pdf",
  };

  await putJson(hacktivateDocPath(facts.team.code, id), record, false);
  const next = await state();
  return { ok: true, doc: metaOf(record), state: next };
}

export type DeleteResult =
  | { ok: true; state: ParticipantDocsState }
  | { ok: false; status: number; code: string; message: string; state: ParticipantDocsState };

export async function deleteParticipantPdf(email: string, docId: string): Promise<DeleteResult> {
  const state = () => getParticipantDocs(email);
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

  const id = String(docId ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(id)) {
    return { ok: false, status: 404, code: "not_found", message: DOCS_COPY.notFound, state: await state() };
  }

  const path = hacktivateDocPath(facts.team.code, id);
  const existing = (await readJsonByPath(path)) as HacktivateDocRecord | null;
  if (!existing?.id) {
    return { ok: false, status: 404, code: "not_found", message: DOCS_COPY.notFound, state: await state() };
  }

  await deleteJson(path);
  return { ok: true, state: await state() };
}

export type StaffDocsBoard = {
  total: number;
  docs: HacktivateDocMeta[];
};

export async function getStaffDocsBoard(): Promise<StaffDocsBoard> {
  const records = await listRecords(HACKTIVATE_DOC_PREFIX);
  return { total: records.length, docs: records.map(metaOf) };
}

export type DownloadResult =
  | { ok: true; record: HacktivateDocRecord; bytes: Buffer }
  | { ok: false; status: number; message: string };

export async function getDocForDownload(docId: string, teamCode?: string): Promise<DownloadResult> {
  const id = String(docId ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(id)) {
    return { ok: false, status: 404, message: DOCS_COPY.notFound };
  }

  if (teamCode) {
    const path = hacktivateDocPath(teamCode, id);
    const record = (await readJsonByPath(path)) as HacktivateDocRecord | null;
    if (!record?.contentBase64) return { ok: false, status: 404, message: DOCS_COPY.notFound };
    return { ok: true, record, bytes: Buffer.from(record.contentBase64, "base64") };
  }

  const records = await listRecords(HACKTIVATE_DOC_PREFIX);
  const record = records.find((r) => r.id === id);
  if (!record) return { ok: false, status: 404, message: DOCS_COPY.notFound };
  return { ok: true, record, bytes: Buffer.from(record.contentBase64, "base64") };
}
