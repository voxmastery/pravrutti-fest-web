/**
 * Hacktivate demo-video Google Drive links.
 *
 * Confirmed teams paste a Drive share link and submit. Organisers and
 * Hacktivate coordinators open those links from the dashboard. One link per
 * team (resubmit replaces). Stored in MySQL kv — not on the ephemeral disk.
 */

export const HACKTIVATE_DEMO_PREFIX = "hacktivate-demo/";

export const DOCS_COPY = {
  signIn: "Sign in with the Google account on your Hacktivate registration.",
  noTeam: "No Hacktivate team is linked to this email. Sign in with the account your lead registered.",
  notConfirmed:
    "Demo video links are open to confirmed Hacktivate teams. Your team is still in review or not eligible.",
  badLink:
    "Paste a Google Drive link (drive.google.com or docs.google.com). Make sure sharing is set so organisers can open it.",
  empty: "Paste your Google Drive link before submitting.",
  staffOnly: "Demo video links are for Hacktivate organisers and coordinators.",
  notFound: "That team has not submitted a demo video link.",
  saved: "Demo video link saved.",
  cleared: "Demo video link removed.",
} as const;

export type HacktivateDemoLink = {
  teamCode: string;
  teamName: string;
  driveUrl: string;
  submittedByEmail: string;
  submittedByName: string;
  submittedAt: string;
};

export function hacktivateDemoPath(teamCode: string): string {
  return `${HACKTIVATE_DEMO_PREFIX}${String(teamCode).trim().toUpperCase()}.json`;
}

/** Accept only Google Drive / Docs share URLs. */
export function normalizeDriveUrl(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "drive.google.com" ||
    host === "docs.google.com" ||
    host.endsWith(".drive.google.com");
  if (!allowed) return null;

  parsed.hash = "";
  // Drop tracking noise; keep id / resource keys.
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith("usp") || key === "authuser" || key === "resourcekey") {
      /* keep resourcekey; drop usp/authuser */
      if (key.startsWith("usp") || key === "authuser") parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

export type ValidateDriveResult =
  | { ok: true; driveUrl: string }
  | { ok: false; code: "empty" | "bad_link"; message: string };

export function validateDriveUrl(raw: string): ValidateDriveResult {
  if (!String(raw ?? "").trim()) {
    return { ok: false, code: "empty", message: DOCS_COPY.empty };
  }
  const driveUrl = normalizeDriveUrl(raw);
  if (!driveUrl) {
    return { ok: false, code: "bad_link", message: DOCS_COPY.badLink };
  }
  return { ok: true, driveUrl };
}
