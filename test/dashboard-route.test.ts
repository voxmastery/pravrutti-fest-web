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

  it("a coordinator cannot obtain contacts by asking differently", async () => {
    // The role decides the shape; nothing in the request can change it.
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await GET(new Request("http://t?contacts=1&full=true"), {
      params: Promise.resolve({ eventId: "robo-climb" }),
    });
    expect(JSON.stringify(await res.json())).not.toContain("@x.com");
  });

  it("NEVER returns contact details to a coordinator", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const body = await (await get("robo-climb")).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("@x.com");
    expect(serialised).not.toContain("9000000001");
    for (const p of body.roster) {
      expect(p).not.toHaveProperty("email");
      expect(p).not.toHaveProperty("phone");
      expect(p).not.toHaveProperty("paymentRef");
    }
    expect(serialised).not.toContain("4183 7712 9930");
  });

  /* Both units. A coordinator reading one number guessed at the other and
     guessed wrong: Line Follower's 33 was read as 33 teams, not 33 students
     in 17. */
  it("counts the field in teams and in students", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.counts).toEqual({
      registered: 3, teams: 2, confirmed: 2, confirmedTeams: 1, checkedIn: 1, notArrived: 1,
    });
  });

  /* The bug this replaced: every row read from the store was counted, so a
     withdrawn student and an abandoned payment both kept filling a seat.
     CHAOS showed 239 here and 227 in the table above it. */
  it("leaves withdrawn and abandoned registrations out of the counts", async () => {
    apps.push(
      { eventId: "robo-climb", name: "Esha", college: "RUAS", email: "e@x.com",
        phone: "9000000005", status: "cancelled", payment: "not_required" },
      { eventId: "robo-climb", name: "Farid", college: "RUAS", email: "f@x.com",
        phone: "9000000006", status: "pending", payment: "awaiting", paymentRef: null },
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
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
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
