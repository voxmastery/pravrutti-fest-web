import { countsAsRegistered, type Application } from "@/lib/applications";

/**
 * One way to count a field, in both the units people ask about.
 *
 * There is one application row per person, so a four-person team is four
 * rows. Counting rows answers "how many students", which is the right answer
 * to a different question than the one a coordinator is usually asking: Line
 * Follower showed 33 and was read as 33 teams, when it was 33 students in 17.
 * Both numbers are true and neither is enough alone, so both are returned and
 * the screens say which is which.
 *
 * What counts is countsAsRegistered and nothing looser — a withdrawn student
 * or an attempt that never came back from the payment portal is not holding a
 * place, and counting it fills an event that has room. The per-event panel
 * used to count every row it could read, cancelled ones included, which is
 * how CHAOS came to show 239 on one line and 227 on the line above it.
 */

/** The unit a field is actually measured in: a team, or a lone entrant.
    Normalised because a code is displayed uppercase and typed however the
    student likes, and an address the same way. */
export const entryKey = (r: { teamCode?: string | null; email?: string | null }) =>
  r.teamCode
    ? `t:${String(r.teamCode).trim().toUpperCase()}`
    : `s:${String(r.email ?? "").trim().toLowerCase()}`;

export type RegistrationCounts = {
  /** Students holding a place. */
  people: number;
  /** Entries in the field: distinct teams, plus one per solo entrant. */
  teams: number;
  confirmedPeople: number;
  confirmedTeams: number;
  checkedIn: number;
  notArrived: number;
};

export function countRegistrations(rows: readonly Application[]): RegistrationCounts {
  const held = rows.filter(countsAsRegistered);
  const confirmed = held.filter((r) => r.status === "confirmed");
  const checkedIn = confirmed.filter((r) => r.checkedInAt).length;

  return {
    people: held.length,
    teams: new Set(held.map(entryKey)).size,
    confirmedPeople: confirmed.length,
    confirmedTeams: new Set(confirmed.map(entryKey)).size,
    checkedIn,
    notArrived: confirmed.length - checkedIn,
  };
}

/** The same tally, split by event, for the whole-fest views. */
export function countRegistrationsByEvent(
  rows: readonly Application[],
): Map<string, RegistrationCounts> {
  const byEvent = new Map<string, Application[]>();
  for (const r of rows) {
    if (!r?.eventId) continue;
    byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  }
  return new Map([...byEvent].map(([id, rs]) => [id, countRegistrations(rs)]));
}
