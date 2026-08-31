import { promises as fs } from "fs";
import path from "path";

/**
 * Filesystem stand-in for Vercel Blob, used only on a dev machine with no
 * BLOB_READ_WRITE_TOKEN.
 *
 * Without it the dashboards are unusable locally: every roster request 500s,
 * so the one surface that most needs looking at can only be seen against
 * production data. This keeps registrations in a gitignored folder instead.
 *
 * It is a stand-in, not an emulator. Notably it inherits the same missing
 * compare-and-swap as the real thing, so it does not paper over the race that
 * listTeamMembers exists to avoid.
 */
const ROOT = path.join(process.cwd(), ".dev-blob");

/** Marks a URL as filesystem-backed so readPrivate knows not to fetch it. */
export const DEV_URL_PREFIX = "devfs:";

/** True when we should use the filesystem rather than Vercel Blob. */
export function useDevBlob(): boolean {
  return (
    process.env.NODE_ENV !== "production" && !process.env.BLOB_READ_WRITE_TOKEN?.trim()
  );
}

/** Blob pathnames are virtual; keep them from escaping the store. */
function safeJoin(pathname: string): string {
  const clean = pathname.replace(/^\/+/, "").split("/").filter((s) => s && s !== "..");
  return path.join(ROOT, ...clean);
}

export async function devListAll(prefix: string) {
  const out: { pathname: string; url: string }[] = [];

  async function walk(dir: string, rel: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // nothing written yet is an empty store, not an error
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), childRel);
      else if (childRel.startsWith(prefix)) {
        out.push({ pathname: childRel, url: `${DEV_URL_PREFIX}${childRel}` });
      }
    }
  }

  await walk(ROOT, "");
  return out;
}

export async function devReadJson(pathname: string) {
  try {
    return JSON.parse(await fs.readFile(safeJoin(pathname), "utf8"));
  } catch {
    return null;
  }
}

export async function devPutJson(pathname: string, data: unknown) {
  const file = safeJoin(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return { pathname, url: `${DEV_URL_PREFIX}${pathname}` };
}
