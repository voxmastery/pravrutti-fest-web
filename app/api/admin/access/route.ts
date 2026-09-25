import { NextResponse } from "next/server";
import { resolveRole, envFacultyEmails } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { loadAccess, saveAccess } from "@/lib/access-store";
import { applyAction, type AccessAction } from "@/lib/access-control";
import { events, eventId } from "@/lib/pravrutti-data";
import { deskEmailsFor } from "@/lib/dashboard-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Who can see what — read and changed by organisers only.
 *
 * Organiser-only for the same reason payment verification is: this decides who
 * can read every applicant's contact details and mark money as received.
 * Coordinators must not be able to grant themselves more than they were given.
 */
async function organiserOnly() {
  const role = await resolveRole();
  if (role.kind !== "organiser") return { error: fail("Only organisers can change access.", 403) };
  return { email: (await resolveEmail()) ?? "unknown" };
}

/** The env-granted organisers, shown so the UI can mark them unremovable. */
function envOrganisers(): string[] {
  return (process.env.ORGANISER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const who = await organiserOnly();
  if ("error" in who) return who.error;

  const access = await loadAccess();
  return NextResponse.json(
    {
      access,
      /* Listed so the dashboard can show them greyed out rather than offering a
         Remove that would fail — they are the lockout guard. */
      permanentOrganisers: envOrganisers(),
      /* FACULTY_EMAILS: shown without a Remove, same as env organisers. */
      permanentFaculty: envFacultyEmails(),
      events: events.map((e) => ({
        eventId: eventId(e.name),
        name: e.name,
        coordinators: deskEmailsFor(eventId(e.name)).length,
      })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const who = await organiserOnly();
  if ("error" in who) return who.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const action = body as AccessAction;
  if (!action || typeof action.type !== "string") return fail("Missing action.", 400);

  const result = applyAction(await loadAccess(), action, who.email);
  if ("error" in result) return fail(result.error, 400);

  try {
    await saveAccess(result.access);
  } catch (e) {
    console.error("access save failed", e);
    return fail("That didn't save. Try again in a moment.", 500);
  }

  return NextResponse.json({ ok: true, access: result.access }, { headers: { "cache-control": "no-store" } });
}
