import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { verifyPayment, unverifyPayment } from "@/lib/payment-review";

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
 * The transitions themselves — and the confirmation email that follows a
 * verification — live in lib/payment-review.ts, shared with the registrations
 * desk at /dashboard/applications so the two screens cannot drift apart.
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

  const by = (await resolveEmail()) ?? "unknown";
  const outcome = verified
    ? await verifyPayment({ eventId, email, by })
    : await unverifyPayment({ eventId, email });

  if (!outcome) return fail("No application found.", 404);

  const next = outcome.application;
  return NextResponse.json({
    ok: true,
    payment: next.payment,
    status: next.status,
    paymentVerifiedAt: next.paymentVerifiedAt ?? null,
    paymentVerifiedBy: next.paymentVerifiedBy ?? null,
    // Null when nothing was attempted, so the roster can stay quiet rather
    // than reporting on a send that never happened.
    mail: outcome.mail,
  });
}
