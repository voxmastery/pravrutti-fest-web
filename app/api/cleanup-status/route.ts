import { NextResponse } from "next/server";
import { listAll, readPrivate } from "@/lib/blob-store";
import { demoCleanupStatus } from "@/lib/demo-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* "roppashreeganesh@gmail.com" -> "ro…@gmail.com". Enough for an organiser to
   tell their own accounts apart; not enough to harvest an address. */
const mask = (email: string) => {
  const [user, domain] = String(email).split("@");
  return `${user.slice(0, 2)}…@${domain ?? ""}`;
};

/**
 * Whether the one-time demo-account cleanup has run, and what it removed.
 * Only the demo accounts' own records are listed, by event and kind; no
 * other applicant's data is read here, and addresses are shortened.
 */
export async function GET() {
  const s = await demoCleanupStatus().catch(() => null);
  if (!s) return NextResponse.json({ state: "not-run" }, { headers: { "cache-control": "no-store" } });

  let removed: { account: string; what: string }[] = [];
  try {
    const logs = (await listAll("admin/purge-log/")).sort((a, b) => a.url.localeCompare(b.url));
    const log = logs.length ? ((await readPrivate(logs[logs.length - 1].url)) as any) : null;
    if (log?.by === "demo-cleanup (automatic)")
      removed = (log.records ?? [])
        .filter((r: any) => r.data != null)
        .map((r: any) => ({ account: mask(r.email), what: String(r.label) }));
  } catch {
    /* the counts below still answer whether it ran */
  }

  return NextResponse.json(
    {
      state: s.state,
      finishedAt: s.finishedAt ?? null,
      deleted: s.deleted ?? null,
      keptForRealTeammates: s.keptForRealTeammates ?? null,
      removed,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
