import "server-only";
import { readJsonByPath, putJson } from "@/lib/blob-store";
import { DEFAULT_ACCESS, readAccess, type AccessConfig } from "@/lib/access-control";

/**
 * Reading and writing the access record. The rules themselves are pure and live
 * in lib/access-control.ts; this is only the I/O.
 */

const ACCESS_PATH = "admin/access.json";

/**
 * Never throws. Role resolution runs on every dashboard request, and a storage
 * blip must not lock out the people who would fix it — an unreadable record
 * falls back to the defaults, which grant nothing extra and leave env
 * organisers working exactly as before.
 */
export async function loadAccess(): Promise<AccessConfig> {
  try {
    return readAccess(await readJsonByPath(ACCESS_PATH));
  } catch {
    return DEFAULT_ACCESS;
  }
}

export async function saveAccess(access: AccessConfig): Promise<void> {
  await putJson(ACCESS_PATH, access, true);
}
