import "server-only";
import { createHash } from "crypto";
import { listAll, readPrivate } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
import type { Team, TeamMember } from "@/lib/teams";
import { countRegistrations, entryKey, heldRows, isTeammate } from "@/lib/registration-counts";

/**
 * An event's roster as the dashboard shows it, for one kind of viewer.
 *
 * Built here rather than in the route so the same answer can be checked
 * from outside a signed-in session: /api/admin/roster asks for both views
 * of an event and compares them, which is how "a coordinator sees only the
 * lead" gets answered from the data instead of from a phone call.
 */

export type RosterView = "organiser" | "coordinator";

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
export type RosterEntry = {
  name: string;
  college: string;
  email: string;
  phone: string;
  /** "invited": added by their lead, invite not accepted yet, so no
      registration of their own. Listed so every teammate's name shows. */
  status: Application["status"] | "invited";
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
export type OrganiserEntry = RosterEntry & {
  teamName: string | null;
  members: string | null;
  payment: Application["payment"];
  appliedAt: string;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: string | null;
  paymentRef: string | null;
};

export async function buildEventRoster(eventId: string, view: RosterView) {
  // Scoped to this event's prefix, not every application in the fest.
  const blobs = await listAll(`app/${eventId}/`);
  const records = (await Promise.all(blobs.map((b) => readPrivate(b.url))))
    .filter(Boolean) as Application[];

  const mine = records.filter((r) => r.eventId === eventId);
  const holding = heldRows(mine);

  const [memberRows, teamRows] = await Promise.all([
    listAll(`team-member/${eventId}/`).then((bs) => Promise.all(bs.map((b) => readPrivate(b.url)))),
    listAll(`team/${eventId}/`).then((bs) => Promise.all(bs.map((b) => readPrivate(b.url)))),
  ]);
  const teams = new Map(
    (teamRows as (Team | null)[])
      .filter((t): t is Team => !!t?.code && !("member" in t) && !t.deletedAt && !t.movedTo)
      .map((t) => [t.code.trim().toUpperCase(), t]),
  );
  const leadOf = new Map([...teams].map(([code, t]) => [code, String(t.createdByEmail ?? "").trim().toLowerCase()]));

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
    /* The team's own lead where the team record names one — after a hand-over
       that is no longer the person who paid — and otherwise read off the
       payment, as before. */
    role: !r.teamCode
      ? null
      : leadOf.has(String(r.teamCode).trim().toUpperCase())
        ? leadOf.get(String(r.teamCode).trim().toUpperCase()) === String(r.email).trim().toLowerCase() ? "lead" : "member"
        : isTeammate(r) ? "member" : r.payment !== "not_required" ? "lead" : null,
  });

  /* Branch on the role, not on a request flag — a coordinator asking for
     the payment record must not be able to get it by asking differently. */
  const roster: (RosterEntry | OrganiserEntry)[] = mine
    .map((r) =>
      view === "organiser"
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

  /* Teammates the lead added who have not accepted have no application, so
     the roster above never had them, and coordinators saw teams missing
     names. They come from the team-member records; they hold no place yet. */
  const applied = new Set(mine.map((r) => String(r.email).trim().toLowerCase()));
  const invited: RosterEntry[] = [];
  for (const rec of memberRows as ({ code?: string; member?: TeamMember } | null)[]) {
    const m = rec?.member;
    const code = String(rec?.code ?? "").trim().toUpperCase();
    const team = teams.get(code);
    /* Anyone on the team list without an application of their own: usually
       an invite not yet accepted, but a join that never wrote its row counts
       too — either way the team showed a name short without them. */
    if (!m?.email || !team) continue;
    if (applied.has(m.email.trim().toLowerCase())) continue;
    invited.push({
      name: m.name,
      college: m.college,
      email: m.email,
      phone: m.phone ?? "",
      status: "invited",
      checkedInAt: null,
      team: team.name?.trim() || "Unnamed team",
      group: createHash("sha256").update(`${eventId}|${entryKey({ teamCode: code })}`).digest("hex").slice(0, 12),
      live: false,
      role: "member",
    });
  }

  /* What a coordinator sees: everyone holding a place — confirmed, or in
     review — and the teammates on those teams who haven't accepted their
     invite yet. On 3 Oct 2026 the organisers limited coordinators to
     confirmed people (unconfirmed entrants were being added to event groups
     as if they had places); on 5 Oct they put teams in review back, after
     Pitch at Mach's coordinator read "11 applications in review" on the
     event page and found none here. They show as in review, and the
     dashboard marks a team nobody on which is confirmed yet. Withdrawn
     people, and teammates whose lead never registered, hold no place and
     stay off a coordinator's desk. Organisers still see everyone. */
  const placedGroups = new Set(roster.filter((r) => r.live).map((r) => r.group));
  const holdsOrJoinsAPlace = (r: RosterEntry) =>
    r.live ||
    (r.team !== null && placedGroups.has(r.group) && (r.status === "pending" || r.status === "invited"));
  const visible: (RosterEntry | OrganiserEntry)[] =
    view === "organiser" ? [...roster, ...invited] : [...roster, ...invited].filter(holdsOrJoinsAPlace);
  visible.sort((a, b) => a.name.localeCompare(b.name));

  /* The roster still lists withdrawn students — the desk needs to see that
     somebody pulled out — but they are not counted. Counting every row read
     from the store is how this panel came to show 239 for CHAOS while the
     table directly above it showed 227. */
  const counts = countRegistrations(mine);

  return {
    counts: {
      /* The same for both views now that a coordinator sees teams in review:
         everyone holding a place, as the event page counts them. */
      registered: counts.people,
      teams: counts.teams,
      confirmed: counts.confirmedPeople,
      confirmedTeams: counts.confirmedTeams,
      checkedIn: counts.checkedIn,
      notArrived: counts.notArrived,
    },
    roster: visible,
  };
}
