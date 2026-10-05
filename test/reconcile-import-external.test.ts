import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { countRegistrations } from "@/lib/registration-counts";

/**
 * Registrations taken on Unstop, brought onto the desk.
 *
 * DENT - INNOVATE also took entries through Unstop, which collected the fee
 * there. Those students exist nowhere on our side: the event read one team,
 * the desk could not check them in, and /ticket had nothing to show them. So
 * an organiser can import Unstop's export — each entry confirmed and paid,
 * the money pointed at the Unstop registration it came through, under the
 * name of the organiser who brought it in.
 *
 * It only ever adds. Someone already registered with us keeps the row they
 * have, and an entry that cannot be read is reported, not guessed at.
 */

const store = new Map<string, any>();
const mailed: string[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m.trim().toLowerCase()}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  putJson: async (p: string, d: unknown, overwrite?: boolean) => {
    if (store.has(p) && !overwrite) throw new Error("exists");
    store.set(p, d);
  },
}));
vi.mock("@/lib/confirmation-email", () => ({
  sendConfirmationEmail: async (a: any) => { mailed.push(a.email); return { sent: true }; },
}));

let POST: typeof import("@/app/api/admin/reconcile/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ POST } = await import("@/app/api/admin/reconcile/route"));
});

const EV = "dent-innovate", BY = "org@example.com";
const NIKESH = {
  externalId: "UK06B06W", teamName: "Kratos", name: "Nikesh Kumar",
  email: "nikeshyadavp7488@gmail.com", phone: "+919572906515",
  college: "Nagaland University", registeredAt: "2026-09-29T03:22:28.000Z",
};
const PRIYA = {
  externalId: "UU40O2D0", teamName: "nitharwalpriya081", name: "Priya Nitharwal",
  email: "nitharwalpriya081@gmail.com", phone: "+919352832387",
  college: "Nims University (NU), Jaipur", registeredAt: "2026-09-29T03:37:08.000Z",
};

const post = async (body: unknown, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await POST(new Request("http://t/api/admin/reconcile", {
    method: "POST", headers, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};
const importRows = (entries: unknown[], over: Record<string, unknown> = {}) =>
  post({ action: "import_external", source: "unstop", eventId: EV, by: BY, entries, ...over });
const row = (email: string) => store.get(`app/${EV}/${email}.json`);

beforeEach(() => { store.clear(); mailed.length = 0; });

describe("POST /api/admin/reconcile { action: import_external }", () => {
  it("is closed without the admin key", async () => {
    expect((await post({ action: "import_external", eventId: EV, by: BY, entries: [NIKESH] }, null)).status).toBe(401);
  });

  it("refuses without naming the organiser who brought them in", async () => {
    expect((await importRows([NIKESH], { by: "" })).status).toBe(400);
    expect(row(NIKESH.email)).toBeUndefined();
  });

  it("refuses an event that does not exist", async () => {
    expect((await importRows([NIKESH], { eventId: "no-such-event" })).status).toBe(404);
  });

  it("refuses a source it does not know", async () => {
    expect((await importRows([NIKESH], { source: "somewhere" })).status).toBe(400);
  });

  it("brings an entry in confirmed and paid, at the event's fee", async () => {
    const res = await importRows([NIKESH]);
    expect(res.status).toBe(200);
    const r = row(NIKESH.email);
    expect(r.status).toBe("confirmed");
    expect(r.payment).toBe("paid");
    expect(r.fee).toBe("Rs. 200/-");
    expect(r.eventName).toBe("DENT - INNOVATE");
    expect(r.ticketId).toMatch(/^PRV-[0-9A-F]{16}$/);
  });

  it("points the money at the Unstop registration, under the organiser's name", async () => {
    await importRows([NIKESH]);
    const r = row(NIKESH.email);
    expect(r.paymentRef).toBe("UNSTOP-UK06B06W");
    expect(r.source).toBe("unstop");
    expect(r.externalId).toBe("UK06B06W");
    expect(r.paymentVerifiedBy).toBe(BY);
    expect(r.paymentVerifiedAt).toBeTruthy();
  });

  it("keeps their details, in the shape the desk uses", async () => {
    await importRows([NIKESH]);
    const r = row(NIKESH.email);
    expect(r.name).toBe("Nikesh Kumar");
    expect(r.phone).toBe("9572906515");
    expect(r.college).toBe("Nagaland University");
    expect(r.appliedAt).toBe(NIKESH.registeredAt);
  });

  /* Unstop names a solo entrant's "team" after their username. */
  it("drops the username Unstop uses as a solo entrant's team name", async () => {
    await importRows([NIKESH, PRIYA]);
    expect(row(NIKESH.email).teamName).toBe("Kratos");
    expect(row(PRIYA.email).teamName).toBeNull();
  });

  it("sends each of them their ticket", async () => {
    const res = await importRows([NIKESH, PRIYA]);
    expect(mailed.sort()).toEqual([NIKESH.email, PRIYA.email].sort());
    expect(res.body.imported).toHaveLength(2);
  });

  it("never replaces a registration someone already has with us", async () => {
    store.set(`app/${EV}/${NIKESH.email}.json`, { email: NIKESH.email, status: "pending", payment: "awaiting" });
    const res = await importRows([NIKESH, PRIYA]);
    expect(row(NIKESH.email).status).toBe("pending");
    expect(res.body.skipped).toEqual([{ email: NIKESH.email, reason: expect.stringMatching(/already registered/i) }]);
    expect(mailed).toEqual([PRIYA.email]);
  });

  it("reports an entry it cannot read instead of guessing", async () => {
    const res = await importRows([{ ...NIKESH, email: "not-an-email" }, PRIYA]);
    expect(res.body.imported.map((r: any) => r.email)).toEqual([PRIYA.email]);
    expect(res.body.skipped[0].reason).toMatch(/email/i);
  });

  it("matches an address whatever its case", async () => {
    await importRows([{ ...NIKESH, email: "NikeshYadavP7488@Gmail.com" }]);
    expect(row(NIKESH.email).email).toBe(NIKESH.email);
  });
});

/**
 * A team entered on Unstop stays a team.
 *
 * CHAOS took eight four-person teams through Unstop, one Rs. 200 per team.
 * Imported row by row they became 31 solo entrants, 31 "teams" on the count
 * and Rs. 6,200 in the books. So rows sharing an Unstop team ID become one
 * team: the leader carries the fee, the rest are covered by them, and the
 * team exists as a team — a record and a roster — so the ticket page and the
 * desk see it like any other.
 */
describe("POST /api/admin/reconcile { action: import_external } — teams", () => {
  const CH = "chaos";
  const member = (name: string, email: string, role: "lead" | "member") => ({
    externalId: "U39ITW47", teamName: "iVision", name, email, role,
    phone: "+917230997704", college: "BMSITM", registeredAt: "2026-09-29T16:44:10.000Z",
  });
  const IVISION = [
    member("Madhav Bansal", "madhav@example.com", "member"),
    member("Fahad Ishak", "fahad@example.com", "lead"),
    member("Sriram Reddy", "sriram@example.com", "member"),
    member("Roshan V", "roshan@example.com", "member"),
  ];
  const importTeam = (entries: unknown[]) =>
    post({ action: "import_external", source: "unstop", eventId: CH, by: BY, entries });
  const app = (email: string) => store.get(`app/${CH}/${email}.json`);
  const apps = () => [...store.entries()].filter(([k]) => k.startsWith(`app/${CH}/`)).map(([, v]) => v);

  it("puts everyone on one team, under one code", async () => {
    await importTeam(IVISION);
    const codes = new Set(apps().map((a) => a.teamCode));
    expect(codes.size).toBe(1);
    expect([...codes][0]).toMatch(/^[A-Z2-9]{12}$/);
    expect(apps().every((a) => a.teamName === "iVision")).toBe(true);
  });

  it("charges the leader alone, whatever order the rows come in", async () => {
    await importTeam(IVISION);
    expect(app("fahad@example.com")).toMatchObject({ payment: "paid", fee: "Rs. 200/-", paymentRef: "UNSTOP-U39ITW47", paymentVerifiedBy: BY });
    for (const e of ["madhav@example.com", "sriram@example.com", "roshan@example.com"])
      expect(app(e)).toMatchObject({ status: "confirmed", payment: "not_required", fee: "Covered by team lead", paymentRef: null });
  });

  it("counts as one team of four", async () => {
    await importTeam(IVISION);
    const c = countRegistrations(apps());
    expect(c.teams).toBe(1);
    expect(c.people).toBe(4);
    expect(c.confirmedTeams).toBe(1);
  });

  it("creates the team and its roster, led by the leader", async () => {
    await importTeam(IVISION);
    const code = app("fahad@example.com").teamCode;
    expect(store.get(`team/${CH}/${code}.json`)).toMatchObject({ name: "iVision", createdByEmail: "fahad@example.com" });
    for (const p of IVISION)
      expect(store.get(`team-member/${CH}/${p.email}.json`)).toMatchObject({ code, member: { email: p.email, name: p.name } });
  });

  it("sends every member their ticket", async () => {
    await importTeam(IVISION);
    expect(mailed.sort()).toEqual(IVISION.map((p) => p.email).sort());
  });

  /* Splitting a team between a registration we hold and one we import
     would leave two leads, or a member covered by nobody. */
  it("leaves a whole team out if anyone on it is already registered", async () => {
    store.set(`app/${CH}/sriram@example.com.json`, { email: "sriram@example.com", status: "confirmed", payment: "paid" });
    const res = await importTeam(IVISION);
    expect(res.body.imported).toEqual([]);
    expect(app("fahad@example.com")).toBeUndefined();
    expect(res.body.skipped.map((s: any) => s.email).sort()).toEqual(IVISION.map((p) => p.email).sort());
    expect(res.body.skipped[0].reason).toMatch(/sriram@example.com/);
  });

  it("leaves a whole team out if anyone on it is on another team here", async () => {
    store.set(`team-member/${CH}/roshan@example.com.json`, { code: "OTHERTEAM123", eventId: CH, member: { email: "roshan@example.com" } });
    const res = await importTeam(IVISION);
    expect(res.body.imported).toEqual([]);
    expect(app("fahad@example.com")).toBeUndefined();
  });

  it("takes the first row as leader when nobody is marked", async () => {
    await importTeam(IVISION.map(({ role: _r, ...p }) => p));
    expect(app("madhav@example.com").payment).toBe("paid");
    expect(app("fahad@example.com").payment).toBe("not_required");
  });

  it("keeps a one-person 'team' a solo entry", async () => {
    await importTeam([IVISION[1]]);
    expect(app("fahad@example.com").teamCode).toBeNull();
    expect(app("fahad@example.com").teamName).toBe("iVision");
  });
});
