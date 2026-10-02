import { describe, it, expect } from "vitest";
import { countRegistrations, entryKey, heldRows } from "@/lib/registration-counts";

/**
 * What "registered" means on the desk.
 *
 * Two different questions were being answered by one number, and neither
 * well. A coordinator opening Line Follower saw 33 and read it as 33 teams
 * — it was 33 students in 17 teams. And the per-event panel counted every
 * row it could find, cancelled ones included, so CHAOS read 239 there and
 * 227 in the table directly above it.
 *
 * So: one counter, both units, and only registrations that actually hold a
 * place. An abandoned attempt is not a registration — counting it fills an
 * event that has room.
 */

const row = (over: Record<string, unknown> = {}) => ({
  eventId: "line-follower", name: "A", email: "a@x.com", phone: "9000000000",
  college: "RUAS", status: "confirmed", payment: "paid", teamCode: null,
  ...over,
}) as never;

describe("counting a field in teams and in people", () => {
  it("counts a four-person team as one team and four people", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", teamCode: "ABCD1234EFGH" }),
      row({ email: "b@x.com", teamCode: "ABCD1234EFGH", payment: "not_required" }),
      row({ email: "c@x.com", teamCode: "ABCD1234EFGH", payment: "not_required" }),
      row({ email: "d@x.com", teamCode: "ABCD1234EFGH", payment: "not_required" }),
    ]);
    expect(c.people).toBe(4);
    expect(c.teams).toBe(1);
  });

  it("counts each solo entrant as their own entry", () => {
    const c = countRegistrations([row({ email: "a@x.com" }), row({ email: "b@x.com" })]);
    expect(c.people).toBe(2);
    expect(c.teams).toBe(2);
  });

  /* Team codes are shown uppercase and typed however the student likes. */
  it("treats a team code as the same team whatever its case", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", teamCode: "abcd1234efgh" }),
      row({ email: "b@x.com", teamCode: "ABCD1234EFGH", payment: "not_required" }),
    ]);
    expect(c.teams).toBe(1);
  });

  it("splits confirmed from the whole field, in both units", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", teamCode: "T1AAAAAAAAAA", status: "confirmed" }),
      row({ email: "b@x.com", teamCode: "T1AAAAAAAAAA", status: "confirmed", payment: "not_required" }),
      row({ email: "c@x.com", teamCode: "T2BBBBBBBBBB", status: "pending", payment: "awaiting", paymentRef: "REF123456789012" }),
    ]);
    expect(c.people).toBe(3);
    expect(c.teams).toBe(2);
    expect(c.confirmedPeople).toBe(2);
    expect(c.confirmedTeams).toBe(1);
  });
});

describe("what does not hold a place", () => {
  /* The bug this was written for: the per-event panel counted every row, so
     a withdrawn student kept filling a seat on the desk's own screen. */
  it("leaves out cancelled and declined rows entirely", () => {
    const c = countRegistrations([
      row({ email: "a@x.com" }),
      row({ email: "b@x.com", status: "cancelled" }),
      row({ email: "c@x.com", status: "declined" }),
    ]);
    expect(c.people).toBe(1);
    expect(c.teams).toBe(1);
  });

  /* Left for the payment portal and never came back. */
  it("leaves out an unpaid attempt with no receipt reference", () => {
    const c = countRegistrations([row({ status: "pending", payment: "awaiting", paymentRef: null })]);
    expect(c.people).toBe(0);
  });

  it("counts someone who paid and is waiting on us, because their place is taken", () => {
    const c = countRegistrations([
      row({ status: "pending", payment: "awaiting", paymentRef: "J5N3Z8Y0MUQG1UY" }),
    ]);
    expect(c.people).toBe(1);
    expect(c.confirmedPeople).toBe(0);
  });

  it("leaves out a refunded place", () => {
    expect(countRegistrations([row({ payment: "refunded" })]).people).toBe(0);
  });

  /* A team whose only live member withdrew is not a team in the field. */
  it("drops a team once nobody on it holds a place", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", teamCode: "GONE11111111", status: "cancelled" }),
      row({ email: "b@x.com", teamCode: "GONE11111111", status: "cancelled", payment: "not_required" }),
    ]);
    expect(c.teams).toBe(0);
  });
});

describe("arrivals", () => {
  it("counts who has checked in and who is still expected", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", checkedInAt: "2026-10-14T04:00:00.000Z" }),
      row({ email: "b@x.com" }),
      row({ email: "c@x.com", status: "pending", payment: "not_required" }),
    ]);
    expect(c.confirmedPeople).toBe(2);
    expect(c.checkedIn).toBe(1);
    expect(c.notArrived).toBe(1);
  });

  /* Only a confirmed person can arrive; a pending one with a scan would be a
     desk error, and must not make notArrived go negative. */
  it("never reports a negative number still to arrive", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", status: "pending", payment: "not_required", checkedInAt: "2026-10-14T04:00:00.000Z" }),
    ]);
    expect(c.notArrived).toBe(0);
    expect(c.checkedIn).toBe(0);
  });
});

describe("entryKey", () => {
  it("is the team for a team entry and the person for a solo one", () => {
    expect(entryKey({ teamCode: "AbCd12345678", email: "x@y.com" })).toBe("t:ABCD12345678");
    expect(entryKey({ teamCode: null, email: "X@Y.com" })).toBe("s:x@y.com");
  });
});

/**
 * A teammate stands where their lead stands.
 *
 * A teammate owes nothing — the lead pays the team's fee — so their own row
 * always looked settled, and was counted as registered whatever the lead had
 * done. Pitch at Mach showed Ranjitha "In review" while her lead Sonika had
 * left for the payment portal and never come back; sixty teammates across
 * thirty-six teams were counted that way, filling caps with teams that had
 * paid nothing. A teammate now holds a place only while somebody on their
 * team who is not a teammate does: the lead, paid or with a receipt in
 * review — or a member an organiser has confirmed.
 */
describe("a teammate stands where their lead stands", () => {
  const COV = "Covered by team lead";
  const lead = (over: Record<string, unknown> = {}) =>
    row({ email: "lead@x.com", status: "pending", payment: "awaiting", paymentRef: "J5N3Z8Y0MUQG1UY",
          fee: "Rs. 200/-", teamCode: "TEAMAAAA1111", ...over });
  const mate = (n: number, over: Record<string, unknown> = {}) =>
    row({ email: `mate${n}@x.com`, status: "pending", payment: "not_required", fee: COV,
          teamCode: "TEAMAAAA1111", ...over });

  it("does not count teammates whose lead left to pay and never came back", () => {
    const c = countRegistrations([lead({ paymentRef: null, stage: "intent" }), mate(1), mate(2)]);
    expect(c.people).toBe(0);
    expect(c.teams).toBe(0);
  });

  it("counts teammates whose lead is in review with a receipt", () => {
    const c = countRegistrations([lead(), mate(1)]);
    expect(c.people).toBe(2);
    expect(c.teams).toBe(1);
  });

  it("counts teammates whose lead is confirmed", () => {
    const c = countRegistrations([lead({ status: "confirmed", payment: "paid" }), mate(1)]);
    expect(c.people).toBe(2);
  });

  it("does not count teammates whose lead never registered at all", () => {
    expect(countRegistrations([mate(1), mate(2)]).people).toBe(0);
  });

  it("does not count teammates whose lead withdrew", () => {
    expect(countRegistrations([lead({ status: "cancelled" }), mate(1)]).people).toBe(0);
  });

  /* The organisers' decision stands: a confirmed teammate holds a place. */
  it("counts a teammate an organiser has confirmed, whatever the lead did", () => {
    const c = countRegistrations([lead({ paymentRef: null }), mate(1, { status: "confirmed" })]);
    expect(c.people).toBe(1);
    expect(c.confirmedPeople).toBe(1);
  });

  /* A free event has no payer to wait on: everyone owes nothing. */
  it("leaves a free event's teams counted as they are", () => {
    const c = countRegistrations([
      row({ email: "a@x.com", status: "pending", payment: "not_required", fee: "Free", teamCode: "FREE00000001" }),
      row({ email: "b@x.com", status: "pending", payment: "not_required", fee: "Free", teamCode: "FREE00000001" }),
    ]);
    expect(c.people).toBe(2);
  });

  it("matches the lead to the team whatever the case of the code", () => {
    const c = countRegistrations([lead({ teamCode: "teamaaaa1111" }), mate(1)]);
    expect(c.people).toBe(2);
  });

  it("judges each team on its own lead", () => {
    const c = countRegistrations([
      lead(), mate(1),
      lead({ email: "lead2@x.com", teamCode: "TEAMBBBB2222", paymentRef: null }),
      mate(2, { teamCode: "TEAMBBBB2222" }),
    ]);
    expect(c.people).toBe(2);
    expect(c.teams).toBe(1);
  });

  /* Teams are per event: a lead registered for one event does not carry a
     teammate on another that happens to share the code after a move. */
  it("does not let a lead on another event carry a teammate", () => {
    const l = lead({ eventId: "chaos" }), m = mate(1);
    const held = heldRows([l, m]);
    expect(held.has(l)).toBe(true);
    expect(held.has(m)).toBe(false);
  });
});

describe("heldRows", () => {
  it("returns exactly the rows holding a place", () => {
    const l = row({ email: "lead@x.com", status: "pending", payment: "awaiting", paymentRef: null,
                    fee: "Rs. 200/-", teamCode: "TEAMAAAA1111" });
    const m = row({ email: "mate@x.com", status: "pending", payment: "not_required",
                    fee: "Covered by team lead", teamCode: "TEAMAAAA1111" });
    const solo = row({ email: "solo@x.com" });
    const held = heldRows([l, m, solo]);
    expect(held.has(solo)).toBe(true);
    expect(held.has(l)).toBe(false);
    expect(held.has(m)).toBe(false);
  });
});
