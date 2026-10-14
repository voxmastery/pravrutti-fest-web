/**
 * Hacktivate schematic / screenshot PDF uploads.
 *
 * Teams upload PDFs (schematics, screenshots, etc.). Organisers and Hacktivate
 * coordinators list and download them from the dashboard. Bytes live in the
 * MySQL kv store as base64 JSON — the deploy filesystem is ephemeral.
 *
 * Client-safe: types, copy, path helpers, size formatting. Node validation
 * lives in lib/hacktivate-docs-node.ts; access checks reuse canManageTrackPick.
 */

export const HACKTIVATE_DOC_MAX_BYTES = 8 * 1024 * 1024;

/** Soft cap so one team cannot flood the store. */
export const HACKTIVATE_DOC_MAX_PER_TEAM = 5;

export const HACKTIVATE_DOC_PREFIX = "hacktivate-doc/";

export const DOCS_COPY = {
  signIn: "Sign in with the Google account on your Hacktivate registration.",
  noTeam: "No Hacktivate team is linked to this email. Sign in with the account your lead registered.",
  notConfirmed:
    "PDF upload is open to confirmed Hacktivate teams. Your team is still in review or not eligible.",
  badType: "Only PDF files are accepted — export or print your schematics / screenshots to PDF first.",
  tooLarge: "That PDF is larger than 8 MB. Compress it or split it into fewer pages.",
  teamFull: "This team already has 5 PDFs. Remove one before uploading another.",
  empty: "That file is empty.",
  staffOnly: "Schematic downloads are for Hacktivate organisers and coordinators.",
  notFound: "That PDF is not on file.",
  badName: "Give the file a short .pdf name.",
} as const;

export type HacktivateDocMeta = {
  id: string;
  teamCode: string;
  teamName: string;
  fileName: string;
  size: number;
  uploadedByEmail: string;
  uploadedByName: string;
  uploadedAt: string;
};

export type HacktivateDocRecord = HacktivateDocMeta & {
  contentBase64: string;
  mimeType: "application/pdf";
};

export function hacktivateDocPath(teamCode: string, id: string): string {
  const code = String(teamCode).trim().toUpperCase();
  return `${HACKTIVATE_DOC_PREFIX}${code}/${id}.json`;
}

export function hacktivateDocTeamPrefix(teamCode: string): string {
  return `${HACKTIVATE_DOC_PREFIX}${String(teamCode).trim().toUpperCase()}/`;
}

/** Safe download / display name: keep basename, force .pdf, strip path bits. */
export function sanitizePdfFileName(raw: string): string | null {
  const base = String(raw ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  if (!base) return null;
  const withoutExt = base.replace(/\.pdf$/i, "").trim();
  if (!withoutExt || /^\.+$/.test(withoutExt)) return null;
  return `${withoutExt}.pdf`;
}

export function metaOf(record: HacktivateDocRecord): HacktivateDocMeta {
  return {
    id: record.id,
    teamCode: record.teamCode,
    teamName: record.teamName,
    fileName: record.fileName,
    size: record.size,
    uploadedByEmail: record.uploadedByEmail,
    uploadedByName: record.uploadedByName,
    uploadedAt: record.uploadedAt,
  };
}

export function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
