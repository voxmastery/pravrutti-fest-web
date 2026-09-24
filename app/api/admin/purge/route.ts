import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { executePurge, parseEmails, planPurge } from "@/lib/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

/**
 * Removing test accounts — organiser session only.
 *
 * Not reachable with the shared ADMIN_KEY: a permanent delete needs a named
 * person against it, and the log records who. POST {emails} previews;
 * POST {emails, confirm: "DELETE"} recomputes the plan and carries it out.
 */
export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Only organisers can remove registrations.", 403);
  const by = (await resolveEmail()) ?? "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const emails = parseEmails(body?.emails);
  if (!emails.length) return fail("Enter at least one email address.", 400);
  if (emails.length > 50) return fail("Fifty addresses at a time, at most.", 400);

  const plan = await planPurge(emails);

  if (body?.confirm !== "DELETE")
    return NextResponse.json({ plan }, { headers: { "cache-control": "no-store" } });

  if (plan.blockers.length) return NextResponse.json({ plan, error: "Resolve the problems listed first." }, { status: 409 });
  if (!plan.items.length) return NextResponse.json({ plan, deleted: 0 });

  try {
    const out = await executePurge(plan, by);
    return NextResponse.json({ plan, ...out }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("purge failed", e);
    return fail("The removal stopped partway. Preview again to see what is left.", 500);
  }
}
