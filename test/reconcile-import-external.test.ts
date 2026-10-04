import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

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
