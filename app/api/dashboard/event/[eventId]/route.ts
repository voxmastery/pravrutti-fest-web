import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import { createHash } from "crypto";
import type { Application } from "@/lib/applications";
import { countRegistrations, entryKey, heldRows, isTeammate } from "@/lib/registration-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only shape a coordinator ever receives.
 *
 * Email and phone are in it since 2 Oct 2026, on the organisers' decision:
 * coordinators ring their own event's people — above all the ones who
 * started registering and never finished. Only their own events reach here
 * (canViewEvent). Nothing about money is in it: the payment ID, who verified
 * it and the lead's member list are OrganiserEntry only, because organisers
 * decide payments.
 */
type RosterEntry = {
  name: string;
  college: string;
  email: string;
  phone: string;
  status: Application["status"];
  checkedInAt: string | null;
  /** The team's display name; null for someone who entered alone. */
  team: string | null;
  /** Same for everyone who entered together. Opaque on purpose: the team
      code is what a stranger types to join a team, and grouping a list
      does not need it. */
  group: string;
  /** Whether this person holds a place — see heldRows. A team block counts
      only these; withdrawn teammates are listed, not counted. A teammate
      holds a place only while their lead does. */
  live: boolean;
  /** "lead" pays for the team; "member" is covered by the lead; null for
      someone entered alone, or on a free event where nobody pays. Without
      it the roster could not say who a team is waiting on. */
  role: "lead" | "member" | null;
};

/**
 * What an organiser additionally gets: the payment record.
 *
 * The two shapes are separate types on purpose: the coordinator's payload is
 * built from a projection that has no payment field to accidentally include.
 */
type OrganiserEntry = RosterEntry & {
  teamName: string | null;
  members: string | null;
  payment: Application["payment"];
  appliedAt: string;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: string | null;
  paymentRef: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const role = await resolveRole();
  // One generic message for both "no access" and "no such event" — a
  // different reply would confirm which events exist.
  if (!canViewEvent(role, eventId))
    return NextResponse.json({ error: "No access to this event." }, { status: 403 });

  // Scoped to this event's prefix, not every application in the fest.
  const blobs = await listAll(`app/${eventId}/`);
  const records = (await Promise.all(blobs.map((b) => readPrivate(b.url))))
    .filter(Boolean) as Application[];

  const mine = records.filter((r) => r.eventId === eventId);
  const holding = heldRows(mine);

  const base = (r: Application): RosterEntry => ({
    name: r.name,
    college: r.college,
    email: r.email,
    phone: r.phone,
    status: r.status,
    checkedInAt: r.checkedInAt ?? null,
    team: r.teamCode ? r.teamName?.trim() || "Unnamed team" : null,
    group: createHash("sha256").update(`${eventId}|${entryKey(r)}`).digest("hex").slice(0, 12),
    live: holding.has(r),
    role: !r.teamCode ? null : isTeammate(r) ? "member" : r.payment !== "not_required" ? "lead" : null,
  });

  /* Branch on the role, not on a request flag — a coordinator asking for
     the payment record must not be able to get it by asking differently. */
  const roster: (RosterEntry | OrganiserEntry)[] = mine
    .map((r) =>
      role.kind === "organiser"
        ? ({
            ...base(r),
            teamName: r.teamName ?? null,
            members: r.members ?? null,
            payment: r.payment,
            appliedAt: r.appliedAt,
            paymentVerifiedBy: r.paymentVerifiedBy ?? null,
            paymentVerifiedAt: r.paymentVerifiedAt ?? null,
            paymentRef: r.paymentRef ?? null,
          } satisfies OrganiserEntry)
        : base(r)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  /* The roster still lists withdrawn students — the desk needs to see that
     somebody pulled out — but they are not counted. Counting every row read
     from the store is how this panel came to show 239 for CHAOS while the
     table directly above it showed 227. */
  const counts = countRegistrations(mine);

  return NextResponse.json(
    {
      eventId,
      counts: {
        registered: counts.people,
        teams: counts.teams,
        confirmed: counts.confirmedPeople,
        confirmedTeams: counts.confirmedTeams,
        checkedIn: counts.checkedIn,
        notArrived: counts.notArrived,
      },
      roster,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
