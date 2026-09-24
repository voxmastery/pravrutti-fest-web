import "server-only";
import { putJson, readJsonByPath } from "@/lib/blob-store";
import { executePurge, planPurge, withoutBlocked } from "@/lib/purge";

/**
 * One-time removal of the organisers' own test accounts from the live data.
 *
 * Nobody here can reach the production database, so the app does it on
 * start-up. The marker below is claimed with overwrite:false first, so it runs
 * exactly once — across restarts and across the two Node processes Hostinger
 * runs — and a copy of every record goes to admin/purge-log/ before anything is
 * deleted (lib/purge.ts).
 *
 * To remove another batch, add the addresses to a NEW list with a new marker
 * name. Editing this one does nothing once it has run.
 */
export const DEMO_EMAILS = [
  "roppashreeganesh@gmail.com",
  "fantasygamer.no.1@gmail.com",
  "ganesh.s0ga@gmail.com",
];

export const DEMO_CLEANUP_MARKER = "admin/migrations/demo-cleanup-2026-09-24.json";

export type CleanupStatus = {
  state: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  deleted?: number;
  /** Records left because a real person is on a team a demo account leads. */
  keptForRealTeammates?: number;
  error?: string;
};

export async function runDemoCleanup(): Promise<CleanupStatus | null> {
  const startedAt = new Date().toISOString();
  try {
    await putJson(DEMO_CLEANUP_MARKER, { state: "running", startedAt } satisfies CleanupStatus, false);
  } catch {
    return null; // already claimed: ran before, or the other process has it
  }

  try {
    const full = await planPurge(DEMO_EMAILS);
    const safe = withoutBlocked(full);
    const { deleted } = await executePurge(safe, "demo-cleanup (automatic)");
    const status: CleanupStatus = {
      state: "done",
      startedAt,
      finishedAt: new Date().toISOString(),
      deleted,
      keptForRealTeammates: full.items.length - safe.items.length,
    };
    await putJson(DEMO_CLEANUP_MARKER, status, true);
    console.log(`[demo-cleanup] deleted=${deleted} kept=${status.keptForRealTeammates}`);
    return status;
  } catch (e) {
    const status: CleanupStatus = {
      state: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    };
    await putJson(DEMO_CLEANUP_MARKER, status, true).catch(() => {});
    console.error("[demo-cleanup] failed", e);
    return status;
  }
}

/** Counts only — no addresses — so it can be read without signing in. */
export async function demoCleanupStatus(): Promise<CleanupStatus | null> {
  return (await readJsonByPath(DEMO_CLEANUP_MARKER)) as CleanupStatus | null;
}
