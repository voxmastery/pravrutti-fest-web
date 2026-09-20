import { NextResponse } from "next/server";
import { runReferenceReminders } from "@/lib/reference-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The reminder pass, run by hand with the admin key. The app also runs it on
 * its own every hour in sending hours (lib/reference-reminder-scheduler), so
 * this exists for "send them now" and for `dryRun`, which lists who would
 * get one and sends nothing.
 */

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const run = await runReferenceReminders({ dryRun: body?.dryRun === true });
  return NextResponse.json(run);
}
