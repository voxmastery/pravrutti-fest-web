import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { listAll, readPrivate, applicationPath, readJsonByPath } from "@/lib/blob-store";
import { events, eventId } from "@/lib/pravrutti-data";
import type { Application } from "@/lib/applications";
import { mailerConfigured } from "@/lib/mailer";
import { ticketQrDataUrl } from "@/lib/ticket-qr";
import {
  verifyPayment,
  verifyTeam,
  declineTeam,
  unverifyPayment,
  declineApplication,
  setPaymentRef,
  resendConfirmation,
} from "@/lib/payment-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * The registrations desk: every application across the fest, in one list.
 *
 * Organiser-only. `/api/dashboard/event/[eventId]` already answers the
 * coordinator's question ("who is on my event"), and this one is the
 * fest-wide roll-up with contact and money fields attached — which is
 * exactly the data a coordinator has no business holding for other events.
 */
export async function GET(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Organisers only.", 403);

  const url = new URL(req.url);

  // A QR is asked for one row at a time. Rendering 2,000 of them into a list
  // response would cost far more than the one an organiser is looking at.
  const qrFor = url.searchParams.get("qr");
  if (qrFor) {
    const [evId, ...rest] = qrFor.split(":");
    const email = rest.join(":").toLowerCase();
    if (!evId || !email) return fail("Missing event or applicant.", 400);
    const record = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
    if (!record) return fail("No application found.", 404);
    if (record.status !== "confirmed") return fail("No ticket until this application is confirmed.", 409);
    return NextResponse.json({ qr: await ticketQrDataUrl(record) });
  }

  const blobs = await listAll("app/");
  const raw = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (Application | null)[];
  const applications = raw
    .filter((a): a is Application => !!a?.eventId)
    .map((a) => ({ ...a, paymentRef: a.paymentRef ?? null }));

  applications.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));

  const names = new Map(events.map((e) => [eventId(e.name), e.name]));
  const totals = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    confirmed: applications.filter((a) => a.status === "confirmed").length,
    declined: applications.filter((a) => a.status === "declined").length,
    awaitingPayment: applications.filter((a) => a.payment === "awaiting").length,
    paid: applications.filter((a) => a.payment === "paid").length,
    emailed: applications.filter((a) => !!a.confirmationEmailAt).length,
  };

  return NextResponse.json({
    mailConfigured: mailerConfigured(),
    totals,
    events: [...new Set(applications.map((a) => a.eventId))]
      .map((id) => ({ eventId: id, name: names.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    applications,
  });
}

type Action =
  | "verify_payment"
  | "verify_team"
  | "decline_team"
  | "unverify_payment"
  | "decline"
  | "set_payment_ref"
  | "resend_confirmation";

const ACTIONS: Action[] = [
  "verify_payment",
  "verify_team",
  "decline_team",
  "unverify_payment",
  "decline",
  "set_payment_ref",
  "resend_confirmation",
];

export async function POST(req: Request) {
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Organisers only.", 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const action = String(body?.action ?? "") as Action;
  const evId = String(body?.eventId ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!ACTIONS.includes(action)) return fail("Unknown action.", 400);

  const by = (await resolveEmail()) ?? "unknown";
  const rawRef = body?.paymentRef;
  const paymentRef =
    rawRef === undefined ? undefined : String(rawRef ?? "").trim().slice(0, 80) || null;

  /* Addressed by team rather than by person: the fee is one payment for the
     team, so the decision is one decision. */
  if (action === "verify_team" || action === "decline_team") {
    const teamCode = String(body?.teamCode ?? "").trim();
    if (!evId || !teamCode) return fail("Missing event or team.", 400);
    const team =
      action === "verify_team"
        ? await verifyTeam({ eventId: evId, code: teamCode, by, paymentRef })
        : await declineTeam({ eventId: evId, code: teamCode });
    if (!team) return fail("No live registrations for that team.", 404);
    return NextResponse.json({ ok: true, applications: team.applications, mails: team.mails });
  }

  if (!evId || !email) return fail("Missing event or applicant.", 400);

  const outcome =
    action === "verify_payment"
      ? await verifyPayment({ eventId: evId, email, by, paymentRef })
      : action === "unverify_payment"
      ? await unverifyPayment({ eventId: evId, email })
      : action === "decline"
      ? await declineApplication({ eventId: evId, email })
      : action === "set_payment_ref"
      ? await setPaymentRef({ eventId: evId, email, paymentRef: paymentRef ?? null })
      : await resendConfirmation({ eventId: evId, email });

  if (!outcome) return fail("No application found.", 404);

  return NextResponse.json({
    ok: true,
    application: outcome.application,
    mail: outcome.mail,
  });
}
