import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { applicationPath, readJsonByPath, putJson } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Record that an organiser has seen the money arrive.
 *
 * Organiser-only, and deliberately not open to coordinators: taking a paid
 * place is the decision with the most consequence in this system, and a
 * coordinator marking their own event's applicants as paid is exactly the
 * conflict of interest to avoid.
 *
 * Verifying also confirms a pending application, because the organisers'
 * own rule is "approve everyone who has paid" — leaving them separate would
 * mean two clicks for the only case that actually happens. A declined
 * application is never revived by a payment, which is the one exception.
 *
 * Reversible, because the common failure is a mis-click on the wrong row and
 * the only thing worse than no undo is a queue you cannot correct.
 */
export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser")
    return fail("Only organisers can verify payments.", 403);

  let body: { eventId?: unknown; email?: unknown; verified?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const email = typeof body.email === "string" ? body.email.toLowerCase() : "";
  const verified = body.verified !== false; // default to marking paid
  if (!eventId || !email) return fail("Missing event or applicant.", 400);

  const path = applicationPath(eventId, email);
  const record = (await readJsonByPath(path)) as Application | null;
  if (!record) return fail("No application found.", 404);

  const by = (await resolveEmail()) ?? "unknown";
  const at = new Date().toISOString();

  const next: Application = verified
    ? {
        ...record,
        payment: "paid",
        paymentVerifiedAt: at,
        paymentVerifiedBy: by,
        // Paid means in — unless they were explicitly turned away.
        status: record.status === "pending" ? "confirmed" : record.status,
        decidedAt: record.status === "pending" ? at : record.decidedAt,
      }
    : {
        ...record,
        payment: "awaiting",
        paymentVerifiedAt: undefined,
        paymentVerifiedBy: undefined,
        // Undo returns them to the queue, but never un-declines anyone.
        status: record.status === "confirmed" ? "pending" : record.status,
      };

  await putJson(path, next, true);

  return NextResponse.json({
    ok: true,
    payment: next.payment,
    status: next.status,
    paymentVerifiedAt: next.paymentVerifiedAt ?? null,
    paymentVerifiedBy: next.paymentVerifiedBy ?? null,
  });
}
