import { TEST_SITE } from "@/lib/test-site";

/**
 * In-memory store for the Vercel test site only (see lib/test-site.ts).
 *
 * Vercel has no MySQL, so this lets /api/register succeed and hand the dialog a
 * real record to render the "under review" screen. It is deliberately ephemeral:
 * a serverless instance keeps it only for its own warm lifetime, so it is right
 * for demoing the submit → review-card step and never suitable for anything
 * durable. Enabled only when TEST_SITE is set.
 */
export const MEM_URL_PREFIX = "mem:";

const store = new Map<string, unknown>();

export function memEnabled(): boolean {
  return TEST_SITE;
}

export async function memListAll(prefix: string) {
  return [...store.keys()]
    .filter((k) => k.startsWith(prefix))
    .map((k) => ({ url: MEM_URL_PREFIX + k }));
}

export async function memReadJson(pathname: string) {
  return store.has(pathname) ? store.get(pathname) : null;
}

/** Mirrors sqlPutJson: `overwrite: false` throws on an existing key so the
    duplicate-registration guard behaves the same as in production. */
export async function memPutJson(pathname: string, data: unknown, overwrite: boolean) {
  if (!overwrite && store.has(pathname)) throw new Error("exists");
  store.set(pathname, data);
}

export async function memDeleteJson(pathname: string) {
  store.delete(pathname);
}
