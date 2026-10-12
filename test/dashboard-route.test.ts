import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const apps: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => apps.map((_, i) => ({ pathname: `p${i}`, url: `u${i}` })),
  readPrivate: async (url: string) => apps[Number(url.slice(1))],
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", async () => {
  const actual = await vi.importActual<any>("@/lib/roles");
  return { ...actual, resolveRole: async () => role.current };
});

// Imported in beforeAll (not a top-level await) so the mocks above are
// registered first while still keeping this file's target/module settings
// compatible with `tsc --noEmit` under the project's tsconfig.
let GET: typeof import("@/app/api/dashboard/event/[eventId]/route").GET;
beforeAll(async () => {
  ({ GET } = await import("@/app/api/dashboard/event/[eventId]/route"));
});

const get = (eventId: string) =>
  GET(new Request("http://t"), { params: Promise.resolve({ eventId }) });

beforeEach(() => {
  role.current = { kind: "organiser" };
  apps.length = 0;
  apps.push(
    /* Asha and Bala are one team of two; Chetan entered alone. Every row
       carries a payment, as every stored application does — the counts key
       off it to tell a held place from an abandoned attempt. */
    { eventId: "robo-climb", name: "Asha", college: "RUAS", email: "a@x.com",
      phone: "9000000001", status: "confirmed", checkedInAt: "2026-10-15T04:42:00.000Z",
      payment: "paid", teamCode: "ROBOTEAM0001", teamName: "Robo Rangers",
      paymentRef: "4183 7712 9930" },
    { eventId: "robo-climb", name: "Bala", college: "RUAS", email: "b@x.com",
      phone: "9000000002", status: "confirmed", payment: "not_required",
      teamCode: "ROBOTEAM0001", teamName: "Robo Rangers" },
    { eventId: "robo-climb", name: "Chetan", college: "BMS", email: "c@x.com",
      phone: "9000000003", status: "pending", payment: "paid" },
    { eventId: "skycraft", name: "Deepa", college: "RUAS", email: "d@x.com",
      phone: "9000000004", status: "confirmed", payment: "paid" },
  );
});

describe("GET /api/dashboard/event/[eventId]", () => {
  /* Organisers may now see contacts; coordinators still may not — they were
     always told to go through organisers, who hold the details anyway.
     This asserts on the serialised payload rather than the rendered UI, so a
     future widening of the query cannot pass by relying on the client to
     hide fields. */
  it("returns contact details to an organiser", async () => {
    role.current = { kind: "organiser" };
    const body = await (await get("robo-climb")).json();
    const asha = body.roster.find((p: { name: string }) => p.name === "Asha");
    expect(asha.email).toBe("a@x.com");
    expect(asha.phone).toBe("9000000001");
    expect(asha.paymentRef).toBe("4183 7712 9930");
  });

  it("does not invent a payment ID when the application has none", async () => {
    const body = await (await get("robo-climb")).json();
    const bala = body.roster.find((p: { name: string }) => p.name === "Bala");
    expect(bala.paymentRef).toBeNull();
  });

  /* Changed 2 Oct 2026, on the organisers' decision: coordinators now ring
     their own event's people — above all the ones who started registering
     and never finished — so they get each person's email and phone. Only
     for their own events (see the access tests below), and nothing about
     money: the payment ID, who verified it and the lead's member list stay
     with the organisers, who decide payments. */
  it("gives a coordinator the email and phone of their own event's people", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    const asha = body.roster.find((p: { name: string }) => p.name === "Asha");
    expect(asha.email).toBe("a@x.com");
    expect(asha.phone).toBe("9000000001");
  });

  it("still keeps the payment record from a coordinator", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    for (const p of body.roster) {
      expect(p).not.toHaveProperty("paymentRef");
      expect(p).not.toHaveProperty("paymentVerifiedBy");
      expect(p).not.toHaveProperty("payment");
      expect(p).not.toHaveProperty("members");
    }
    expect(JSON.stringify(body)).not.toContain("4183 7712 9930");
  });

  it("a coordinator cannot obtain the payment record by asking differently", async () => {
    // The role decides the shape; nothing in the request can change it.
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await GET(new Request("http://t?contacts=1&full=true"), {
      params: Promise.resolve({ eventId: "robo-climb" }),
    });
    expect(JSON.stringify(await res.json())).not.toContain("4183 7712 9930");
  });

  it("never gives a coordinator another event's people", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await get("skycraft");
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("@x.com");
  });

  /* Both units. A coordinator reading one number guessed at the other and
     guessed wrong: Line Follower's 33 was read as 33 teams, not 33 students
     in 17. */
  it("counts the field in teams and in students", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.counts).toEqual({
      registered: 3, teams: 2, confirmed: 2, confirmedTeams: 1,
      inReview: 1, inReviewTeams: 1, checkedIn: 1, notArrived: 1,
    });
  });

  /* The bug this replaced: every row read from the store was counted, so a
     withdrawn student and an abandoned payment both kept filling a seat.
     CHAOS showed 239 here and 227 in the table above it. */
  it("leaves withdrawn and declined registrations out of the counts", async () => {
    apps.push(
      { eventId: "robo-climb", name: "Esha", college: "RUAS", email: "e@x.com",
        phone: "9000000005", status: "cancelled", payment: "not_required" },
      { eventId: "robo-climb", name: "Farid", college: "RUAS", email: "f@x.com",
        phone: "9000000006", status: "declined", payment: "refunded", paymentRef: null },
    );
    const body = await (await get("robo-climb")).json();
    expect(body.counts.registered).toBe(3);
    expect(body.counts.teams).toBe(2);
    /* Still listed, though — the desk needs to see that somebody pulled out. */
    expect(body.roster.map((r: any) => r.name)).toContain("Esha");
  });

  /* Grouped by team, because a flat list of 231 names tells a coordinator
     nothing about who came together. The roster carries the team's name
     and an opaque group id — never the team code, which is what a stranger
     types to join a team, and a coordinator has no reason to hold. */
  it("tells the roster which people entered together", async () => {
    role.current = { kind: "organiser" };
    const body = await (await get("robo-climb")).json();
    const by = (n: string) => body.roster.find((r: any) => r.name === n);
    expect(by("Asha").group).toBe(by("Bala").group);
    expect(by("Chetan").group).not.toBe(by("Asha").group);
    expect(by("Asha").team).toBe("Robo Rangers");
    expect(by("Chetan").team).toBeNull();
    expect(JSON.stringify(body)).not.toContain("ROBOTEAM0001");
  });

  /* A withdrawn teammate is still shown — the desk needs to see who pulled
     out — but marked, so a team block can count only the people coming. */
  it("marks who is actually holding a place", async () => {
    apps.push({ eventId: "robo-climb", name: "Esha", college: "RUAS", email: "e@x.com",
      phone: "9000000005", status: "cancelled", payment: "not_required",
      teamCode: "ROBOTEAM0001", teamName: "Robo Rangers" });
    const body = await (await get("robo-climb")).json();
    const by = (n: string) => body.roster.find((r: any) => r.name === n);
    expect(by("Asha").live).toBe(true);
    expect(by("Esha").live).toBe(false);
    expect(by("Esha").group).toBe(by("Asha").group);
  });

  it("returns only this event's applicants", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.roster.map((r: any) => r.name).sort()).toEqual(["Asha", "Bala", "Chetan"]);
  });

  it("lets a coordinator read their own event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("robo-climb")).status).toBe(200);
  });

  it("denies a coordinator another event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("skycraft")).status).toBe(403);
  });

  it("denies a roleless account", async () => {
    role.current = { kind: "none" };
    expect((await get("robo-climb")).status).toBe(403);
  });
});

/* A teammate stands where their lead stands: Pitch at Mach showed Ranjitha
   "In review" while her lead Sonika had left to pay and never come back. The
   roster now marks who the lead is, and a teammate whose lead has not paid
   holds no place. */
describe("the roster judges a teammate by their lead", () => {
  const seed = (leadOver: Record<string, unknown>) => {
    apps.length = 0;
    apps.push(
      { eventId: "pitch-at-mach", name: "Sonika M", college: "NMIT", email: "sonika@x.com",
        phone: "9000000011", status: "pending", payment: "awaiting", fee: "Rs. 200/-",
        teamCode: "ASB255Z3RQCH", teamName: "Avianova", paymentRef: null, stage: "intent", ...leadOver },
      { eventId: "pitch-at-mach", name: "Ranjitha", college: "NMIT", email: "ranjitha@x.com",
        phone: "9000000012", status: "pending", payment: "not_required", fee: "Covered by team lead",
        teamCode: "ASB255Z3RQCH", teamName: "Avianova" },
    );
  };
  const by = (body: any, n: string) => body.roster.find((r: any) => r.name === n);

  it("says which one is the lead", async () => {
    seed({});
    const body = await (await get("pitch-at-mach")).json();
    expect(by(body, "Sonika M").role).toBe("lead");
    expect(by(body, "Ranjitha").role).toBe("member");
  });

  /* Organisers' call, 2 Oct 2026: a lead who left to pay and never came back
     may have paid on Juno, so the whole team is in review and counted. */
  it("puts the whole team in review with a lead who never came back from paying", async () => {
    seed({});
    const body = await (await get("pitch-at-mach")).json();
    expect(by(body, "Sonika M").live).toBe(true);
    expect(by(body, "Ranjitha").live).toBe(true);
    expect(body.counts.registered).toBe(2);
    expect(body.counts.teams).toBe(1);
  });

  it("holds no place for a teammate whose lead withdrew", async () => {
    seed({ status: "cancelled" });
    const body = await (await get("pitch-at-mach")).json();
    expect(by(body, "Ranjitha").live).toBe(false);
    expect(body.counts.registered).toBe(0);
  });

  it("puts the teammate in review alongside a lead who is in review", async () => {
    seed({ paymentRef: "J5N3Z8Y0MUQG1UY", stage: undefined });
    const body = await (await get("pitch-at-mach")).json();
    expect(by(body, "Ranjitha").live).toBe(true);
    expect(by(body, "Sonika M").live).toBe(true);
    expect(body.counts.registered).toBe(2);
    expect(body.counts.teams).toBe(1);
  });

  /* 3 Oct 2026 the organisers limited coordinators to confirmed people; on
     5 Oct they put teams in review back; on 12 Oct they asked for confirmed
     teams only again. Chetan, in review, is off the coordinator's desk and
     out of their counts. */
  it("shows a coordinator confirmed teams only, and counts only those", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    expect(body.roster.map((r: any) => r.name).sort()).toEqual(["Asha", "Bala"]);
    expect(body.counts).toMatchObject({ registered: 2, teams: 1, inReview: 0, inReviewTeams: 0 });
  });

  /* Still not on a coordinator's desk: people holding no place. */
  it("keeps from a coordinator anyone who never finished, or withdrew", async () => {
    apps.push(
      /* A teammate whose lead never registered the team: no place. */
      { eventId: "robo-climb", name: "Ira", college: "RUAS", email: "i@x.com", phone: "9000000009",
        status: "pending", payment: "not_required", fee: "Covered by team lead",
        teamCode: "NOLEADTEAM01", teamName: "Ghosts" },
      { eventId: "robo-climb", name: "Jai", college: "RUAS", email: "j@x.com", phone: "9000000010",
        status: "cancelled", payment: "paid" },
    );
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const names = (await (await get("robo-climb")).json()).roster.map((r: any) => r.name);
    expect(names).not.toContain("Ira");
    expect(names).not.toContain("Jai");
  });

  it("still shows an organiser everyone", async () => {
    role.current = { kind: "organiser" };
    const body = await (await get("robo-climb")).json();
    expect(body.roster.map((r: any) => r.name)).toContain("Chetan");
  });

  /* A teammate the lead added who has not accepted has no application, so
     their name used to be missing from the team. */
  it("lists an invited teammate on their team", async () => {
    apps.push(
      { code: "ROBOTEAM0001", eventId: "robo-climb", name: "Robo Rangers", createdByEmail: "a@x.com" },
      { code: "ROBOTEAM0001", member: { name: "Farah", email: "f@x.com", phone: "9000000006",
        college: "RUAS", joinedAt: "", invitedAt: "2026-10-02T00:00:00Z" } },
    );
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    const by = (n: string) => body.roster.find((r: any) => r.name === n);
    expect(by("Farah")).toMatchObject({ status: "invited", team: "Robo Rangers", live: false, role: "member" });
    expect(by("Farah").group).toBe(by("Asha").group);
    /* Asha and Bala are confirmed; Farah does not hold a place yet. */
    expect(body.counts.registered).toBe(2);
  });

  /* After a hand-over the lead is whoever the team names, not whoever paid. */
  it("tags the team's lead, even when someone else paid", async () => {
    apps.push({ code: "ROBOTEAM0001", eventId: "robo-climb", name: "Robo Rangers", createdByEmail: "b@x.com" });
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    const by = (n: string) => body.roster.find((r: any) => r.name === n);
    expect(by("Bala").role).toBe("lead");
    expect(by("Asha").role).toBe("member");
  });

  /* TitanAlphaa, 3 Oct: a confirmed lead whose teammates were still in review
     showed as a team of one to coordinators. */
  it("shows a coordinator the whole of a confirmed team", async () => {
    apps.push(
      { eventId: "robo-climb", name: "Gita", college: "RUAS", email: "g@x.com",
        phone: "9000000007", status: "pending", payment: "not_required",
        teamCode: "ROBOTEAM0001", teamName: "Robo Rangers" },
      { code: "ROBOTEAM0001", eventId: "robo-climb", name: "Robo Rangers", createdByEmail: "a@x.com" },
      { code: "ROBOTEAM0001", member: { name: "Hari", email: "h@x.com", phone: "9000000008",
        college: "RUAS", joinedAt: "2026-10-02T00:00:00Z" } },
    );
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    const names = body.roster.map((r: any) => r.name).sort();
    expect(names).toEqual(["Asha", "Bala", "Gita", "Hari"]);
  });
});
