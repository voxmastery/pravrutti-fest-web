import { COVERED_BY_LEAD, type Application } from "@/lib/applications";
import { memberStatus, type Team, type TeamMember } from "@/lib/teams";

/**
 * The faculty board: every event's teams and the people on them, read-only.
 *
 * Built from the same three records the registration flow writes —
 * applications (one per person), teams, and per-member team records — and
 * reduced to what faculty asked for: who is on each team, their college, and
 * how to reach them. No payment, reference or ticket fields, and no team join
 * code (that code is what lets a stranger join a team).
 *
 * Pure so it can be tested without a database; the route does the reading.
 */

/** Where one person stands, in words a faculty member would use. */
export type FacultyPersonStatus =
  | "confirmed"
  /** Applied and waiting on the organisers. */
  | "awaiting"
  /** Left for the payment portal and never came back to finish. */
  | "incomplete"
  /** Added by their lead but has not accepted the invite yet. */
  | "invited";

export type FacultyPerson = {
  name: string;
  college: string;
  email: string;
  phone: string;
  isLead: boolean;
  status: FacultyPersonStatus;
  checkedIn: boolean;
};

export type FacultyTeam = {
  /** Stable for React keys; not the join code. */
  key: string;
  eventId: string;
  name: string | null;
  solo: boolean;
  /** Confirmed when anyone on it is — the desk confirms a team as one. */
  confirmed: boolean;
  appliedAt: string;
  people: FacultyPerson[];
};

type MemberRecord = { code?: string; member?: TeamMember } | null;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

function personFromApplication(a: Application): FacultyPerson | null {
  let status: FacultyPersonStatus;
  if (a.status === "confirmed") status = "confirmed";
  else if (a.status === "pending") status = a.stage === "intent" ? "incomplete" : "awaiting";
  else return null; // declined, cancelled, moved: not on the team any more
  return {
    name: a.name,
    college: a.college,
    email: norm(a.email),
    phone: a.phone ?? "",
    isLead: a.fee !== COVERED_BY_LEAD,
    status,
    checkedIn: !!a.checkedInAt,
  };
}

const ORDER: Record<FacultyPersonStatus, number> = { confirmed: 0, awaiting: 1, incomplete: 2, invited: 3 };

export function buildFacultyBoard(
  applications: (Application | null)[],
  teams: (Team | null)[] = [],
  memberRecords: MemberRecord[] = []
): FacultyTeam[] {
  const teamByKey = new Map<string, Team>();
  const teamByCode = new Map<string, Team>();
  for (const t of teams)
    if (t?.eventId && t.code && !t.deletedAt && !t.movedTo) {
      teamByKey.set(`${t.eventId}:${t.code}`, t);
      teamByCode.set(t.code, t);
    }

  const groups = new Map<string, FacultyTeam>();

  for (const a of applications) {
    if (!a?.eventId) continue;
    const person = personFromApplication(a);
    if (!person) continue;
    const code = a.teamCode ?? null;
    const key = code ? `${a.eventId}:${code}` : `${a.eventId}:solo:${person.email}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        eventId: a.eventId,
        name: teamByKey.get(key)?.name || a.teamName || null,
        solo: !code,
        confirmed: false,
        appliedAt: a.appliedAt,
        people: [],
      };
      groups.set(key, g);
    }
    if (!g.name && a.teamName) g.name = a.teamName;
    if (String(a.appliedAt) < String(g.appliedAt)) g.appliedAt = a.appliedAt;
    if (!g.people.some((p) => p.email === person.email)) g.people.push(person);
  }

  /* Teammates a lead added who have not accepted yet have no application, so
     they exist only as team-member records. Without these a confirmed team
     would look a person short. Only added to teams that already have an
     active application — a team nobody has applied for is not on the board. */
  for (const r of memberRecords) {
    const m = r?.member;
    if (!r?.code || !m?.email) continue;
    const t = teamByCode.get(r.code);
    if (!t) continue;
    const g = groups.get(`${t.eventId}:${t.code}`);
    if (!g) continue;
    const email = norm(m.email);
    if (g.people.some((p) => p.email === email)) continue;
    if (memberStatus(m) !== "invited") continue; // joined members have their own application
    g.people.push({
      name: m.name,
      college: m.college,
      email,
      phone: m.phone ?? "",
      isLead: false,
      status: "invited",
      checkedIn: false,
    });
  }

  const out = [...groups.values()];
  for (const g of out) {
    g.confirmed = g.people.some((p) => p.status === "confirmed");
    g.people.sort((x, y) => Number(y.isLead) - Number(x.isLead) || ORDER[x.status] - ORDER[y.status] || x.name.localeCompare(y.name));
  }
  /* The grouping key holds the team's join code, which must not leave the
     server — it is what lets a stranger join. Replace it before returning. */
  return out
    .sort((x, y) => String(x.appliedAt).localeCompare(String(y.appliedAt)))
    .map((g, i) => ({ ...g, key: `${g.eventId}:${i}` }));
}
