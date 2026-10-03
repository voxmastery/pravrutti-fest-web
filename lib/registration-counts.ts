import { countsAsRegistered, COVERED_BY_LEAD, type Application } from "@/lib/applications";

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
 * What counts is heldRows below — countsAsRegistered, judged per team so a
 * teammate stands where their lead stands — and nothing looser: a withdrawn student
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

/** A teammate: on someone else's team, owing nothing because the lead pays.
    A free event's entrants owe nothing too, but they are nobody's teammate
    in this sense — their fee reads "Free", not this. */
export const isTeammate = (r: Pick<Application, "fee">) => r.fee === COVERED_BY_LEAD;

/**
 * The rows that hold a place, judged per team.
 *
 * countsAsRegistered judges one row alone, and a teammate's row alone always
 * looks settled — they owe nothing. So a teammate was counted as registered
 * whatever their lead had done: Pitch at Mach showed Ranjitha "In review"
 * while her lead had left for the payment portal and never come back, and
 * sixty teammates across thirty-six teams filled places for teams that had
 * paid nothing, or whose lead never registered at all.
 *
 * A teammate now holds a place only while somebody on their team, on the
 * same event, who is not a teammate holds one — the lead, paid or with a
 * receipt in review. An organiser's confirmation always stands, so a
 * confirmed teammate holds their place and carries the team. Everyone who is
 * not a teammate is judged on their own row, exactly as before.
 */
export function heldRows<T extends Application>(rows: readonly T[]): Set<T> {
  const teamOf = (r: T) => `${r.eventId}|${String(r.teamCode ?? "").trim().toUpperCase()}`;
  const carried = new Set<string>();
  for (const r of rows)
    if (r.teamCode && countsAsRegistered(r) && (r.status === "confirmed" || !isTeammate(r)))
      carried.add(teamOf(r));

  const held = new Set<T>();
  for (const r of rows) {
    if (!countsAsRegistered(r)) continue;
    if (r.status === "confirmed" || !isTeammate(r) || !r.teamCode || carried.has(teamOf(r))) held.add(r);
  }
  return held;
}

export function countRegistrations(rows: readonly Application[]): RegistrationCounts {
  const holding = heldRows(rows);
  const held = rows.filter((r) => holding.has(r));
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
