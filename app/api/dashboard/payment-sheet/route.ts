import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { listAll, readPrivate, readJsonByPath, applicationPath } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
import { readSheetRows, planFromSheet } from "@/lib/payment-sheet";
import { verifyPayment, verifyTeam } from "@/lib/payment-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approving everybody the college's payment report pays for.
 *
 * Two steps on purpose. "plan" reads the report against the desk and answers
 * with what it would do — who gets confirmed, which payments match nobody,
 * who is still waiting — and writes nothing. "approve" then acts on a list
 * the organiser has actually looked at.
 *
 * Organisers only. This confirms places and sends tickets, which is the
 * decision with the most consequence in the system; coordinators shortlist,
 * they do not approve.
 *
 * Approving happens in small batches because each confirmation is an SMTP
 * round-trip: seventy in one request would sit past any sensible timeout, so
 * the page sends them a few at a time and shows progress.
 */

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const BATCH_CAP = 8;

async function allApplications(): Promise<Application[]> {
  const blobs = await listAll("app/");
  const raw = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  return raw.filter((a): a is Application => !!a?.eventId && !!a?.email);
}

export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Organisers only.", 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const by = (await resolveEmail()) ?? "unknown";

  if (action === "plan") {
    const grid = Array.isArray(body?.rows) ? (body.rows as unknown[][]) : null;
    if (!grid) return fail("That file didn't read as a spreadsheet.", 400);
    const payments = readSheetRows(grid);
    if (payments.length === 0)
      return fail("No payments found in that sheet — check it is the college's payment report.", 422);
    const plan = planFromSheet(payments, await allApplications());
    return NextResponse.json({ ok: true, payments: payments.length, ...plan });
  }

  if (action === "approve") {
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items?.length) return fail("Nothing to approve.", 400);
    if (items.length > BATCH_CAP) return fail(`Send at most ${BATCH_CAP} at a time.`, 400);

    const done: { eventId: string; email: string; confirmed: number; mailed: number }[] = [];
    const failed: { eventId: string; email: string; error: string }[] = [];

    for (const raw of items) {
      const eventId = String(raw?.eventId ?? "").trim();
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const transaction = raw?.transaction ? String(raw.transaction).trim().slice(0, 80) : undefined;
      if (!eventId || !email) {
        failed.push({ eventId, email, error: "Missing event or applicant." });
        continue;
      }
      try {
        /* Re-read rather than trusting what the browser sent back: the row may
           have been confirmed or withdrawn since the plan was drawn. */
        const record = (await readJsonByPath(applicationPath(eventId, email))) as Application | null;
        if (!record) {
          failed.push({ eventId, email, error: "No registration found." });
          continue;
        }
        if (record.status !== "pending") {
          failed.push({ eventId, email, error: `Already ${record.status}.` });
          continue;
        }

        /* A team is confirmed together, and the money is recorded against the
           one person who paid it — the same rule the desk's own button uses. */
        const outcome = record.teamCode
          ? await verifyTeam({ eventId, code: record.teamCode, by, paymentRef: transaction })
          : await verifyPayment({ eventId, email, by, paymentRef: transaction });
        if (!outcome) {
          failed.push({ eventId, email, error: "Nothing to confirm." });
          continue;
        }
        const applications = "applications" in outcome ? outcome.applications : [outcome.application];
        const mails = "mails" in outcome ? outcome.mails : [outcome.mail];
        done.push({
          eventId,
          email,
          confirmed: applications.filter((a) => a.status === "confirmed").length,
          mailed: mails.filter((m) => m?.sent).length,
        });
      } catch (e) {
        failed.push({ eventId, email, error: e instanceof Error ? e.message : "That didn't go through." });
      }
    }

    return NextResponse.json({ ok: true, done, failed });
  }

  return fail("Unknown action.", 400);
}
