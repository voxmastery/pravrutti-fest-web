import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import { createHash } from "crypto";
import { countsAsRegistered, type Application } from "@/lib/applications";
import { countRegistrations, entryKey } from "@/lib/registration-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The only shape a coordinator ever receives. No contact fields exist here,
    so widening the query alone cannot leak an email or phone. */
type RosterEntry = {
  name: string;
  college: string;
  status: Application["status"];
  checkedInAt: string | null;
  /** The team's display name; null for someone who entered alone. */
  team: string | null;
  /** Same for everyone who entered together. Opaque on purpose: the team
      code is what a stranger types to join a team, and grouping a list
      does not need it. */
  group: string;
  /** Whether this person holds a place — see countsAsRegistered. A team
      block counts only these; withdrawn teammates are listed, not counted. */
  live: boolean;
};

/**
 * What an organiser additionally gets.
 *
 * Organisers hold the contact details already — they are the people a
 * coordinator is told to go through — so showing them here removes a
 * pointless relay rather than widening who can see them. Coordinators
 * continue to receive RosterEntry and nothing else.
 *
 * The two shapes are separate types on purpose: the coordinator's payload is
 * built from a projection that has no contact field to accidentally include.
 */
type OrganiserEntry = RosterEntry & {
  email: string;
  phone: string;
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

  const base = (r: Application): RosterEntry => ({
    name: r.name,
    college: r.college,
    status: r.status,
    checkedInAt: r.checkedInAt ?? null,
    team: r.teamCode ? r.teamName?.trim() || "Unnamed team" : null,
    group: createHash("sha256").update(`${eventId}|${entryKey(r)}`).digest("hex").slice(0, 12),
    live: countsAsRegistered(r),
  });

  /* Branch on the role, not on a request flag — a coordinator asking for
     contacts must not be able to get them by asking differently. */
  const roster: (RosterEntry | OrganiserEntry)[] = mine
    .map((r) =>
      role.kind === "organiser"
        ? ({
            ...base(r),
            email: r.email,
            phone: r.phone,
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
