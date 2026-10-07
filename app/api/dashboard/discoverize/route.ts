import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { DISCOVERIZE_EVENT_ID, discoverizeState } from "@/lib/discoverize";
import { setShortlisted, markAbstractSubmitted, discoverizeRoster, migrateToFreeEntry } from "@/lib/discoverize-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discoverize's own desk: who has submitted an abstract, and who goes through
 * to the presentation round.
 *
 * Open to this event's coordinators as well as organisers, because the people
 * who read the abstracts are the ones who decide. It is deliberately the only
 * write a coordinator has: shortlisting says "these teams present, and their
 * lead owes the team's ₹200", never "this money arrived" — verifying a
 * payment stays an organiser's call on /dashboard/applications, where a name
 * is recorded against it.
 */

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function gate() {
  const role = await resolveRole();
  if (!canViewEvent(role, DISCOVERIZE_EVENT_ID)) return null;
  return { role, by: (await resolveEmail()) ?? "unknown" };
}

export async function GET() {
  const who = await gate();
  if (!who) return fail("No access to this event.", 403);

  const teams = (await discoverizeRoster()).map(({ key, members }) => {
    const lead = members[0];
    /* The payer's row carries the fee, so it is the one whose state is the
       team's; a free team has no such row and reads from its first member. */
    const payerRow = members.find((m) => m.payment !== "not_required") ?? lead;
    return {
      key,
      teamName: lead.teamName,
      teamCode: lead.teamCode ?? null,
      state: discoverizeState(payerRow),
      abstractSubmittedAt: lead.round?.abstractSubmittedAt ?? null,
      shortlistedAt: payerRow.round?.shortlistedAt ?? lead.round?.shortlistedAt ?? null,
      shortlistedBy: payerRow.round?.shortlistedBy ?? lead.round?.shortlistedBy ?? null,
      members: members.map((m) => ({
        name: m.name, email: m.email, college: m.college, phone: m.phone,
        status: m.status, payment: m.payment, paymentRef: m.paymentRef ?? null, ticketId: m.ticketId,
      })),
    };
  });
  return NextResponse.json({ teams, shortlisted: teams.filter((t) => t.shortlistedAt).length }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  const who = await gate();
  if (!who) return fail("No access to this event.", 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  /* One-off, and safe to repeat: clears the entry fee off rows written
     before Discoverize entry went free. Shortlisted rows are skipped — their
     fee is the round fee, owed on purpose. Organisers only — it rewrites
     money fields. */
  if (action === "migrate_free") {
    if (who.role.kind !== "organiser") return fail("Organisers only.", 403);
    return NextResponse.json({ ok: true, ...(await migrateToFreeEntry()) });
  }
  const code = body?.code ? String(body.code) : null;
  const email = body?.email ? String(body.email) : null;
  if (!code && !email) return fail("Missing team.", 400);

  if (action === "shortlist" || action === "unshortlist") {
    const out = await setShortlisted({ code, email, by: who.by, shortlisted: action === "shortlist" });
    if (!out) return fail("No live registration for that team.", 404);
    if ("error" in out) return fail(out.error, 409);
    return NextResponse.json({ ok: true, applications: out.applications, payer: out.payer });
  }

  if (action === "mark_abstract") {
    if (!email) return fail("Mark an abstract against a person's email.", 400);
    const out = await markAbstractSubmitted({ email, source: "organiser" });
    if (!out) return fail("No live registration for that address.", 404);
    return NextResponse.json({ ok: true, applications: out.applications });
  }

  return fail("Unknown action.", 400);
}
