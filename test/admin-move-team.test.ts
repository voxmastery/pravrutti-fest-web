import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Students pick the wrong event and only notice later. Their team, their
   places and the lead's payment all have to survive the correction, because
   the alternative — cancel and register again — loses the transaction
   reference and the order they queued in. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  paymentRefPath: (ref: string) => `payment-ref/${ref.trim().toLowerCase()}.json`,
  /* Faithful to the real store: a write that would overwrite without
     permission throws. */
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("exists");
    store.set(p, d);
  },
}));

let POST: typeof import("@/app/api/admin/move-team/route").POST;
beforeAll(async () => {
  process.env.ADMIN_KEY = "k";
  ({ POST } = await import("@/app/api/admin/move-team/route"));
});

const FROM = "hacktivate", TO = "chaos", CODE = "6R99V74RK69C";
const LEAD = "lead@example.com", MATE = "mate@example.com";

const post = async (body: Record<string, unknown>, key = "k") => {
  const res = (await POST(
    new Request("http://t/api/admin/move-team", {
      method: "POST",
      headers: { "x-admin-key": key },
      body: JSON.stringify(body),
    }),
  )) as Response;
  return { status: res.status, body: await res.json() };
};

const move = (over: Record<string, unknown> = {}) =>
  post({ fromEventId: FROM, toEventId: TO, code: CODE, ...over });

function seed() {
  store.set(`team/${FROM}/${CODE}.json`, {
    code: CODE, eventId: FROM, name: "ERROR404", bio: "", createdByEmail: LEAD,
    members: [], createdAt: "2026-09-18T09:29:00.000Z",
  });
  for (const [email, name, joined] of [
    [LEAD, "Keerthana", "2026-09-18T09:29:52.799Z"],
    [MATE, "ShriRaksha K", "2026-09-18T09:34:14.213Z"],
  ] as const) {
    store.set(`team-member/${FROM}/${email}.json`, {
      code: CODE, eventId: FROM,
      member: { name, email, phone: "8123609414", college: "Aditya", joinedAt: joined },
    });
    store.set(`app/${FROM}/${email}.json`, {
      ticketId: `PRV-${name.slice(0, 4).toUpperCase()}`, eventId: FROM, eventName: "Hacktivate",
      status: "pending", payment: email === LEAD ? "awaiting" : "not_required",
      fee: "Rs. 200/-", name, email, phone: "8123609414", college: "Aditya",
      teamName: "ERROR404", teamCode: CODE, members: null,
      paymentRef: email === LEAD ? "626165961670" : null,
      appliedAt: joined,
    });
  }
  store.set("payment-ref/626165961670.json", { eventId: FROM, email: LEAD, claimedAt: "2026-09-18T09:30:00.000Z" });
}

beforeEach(() => { store.clear(); seed(); });

describe("POST /api/admin/move-team", () => {
  it("refuses without the admin key", async () => {
    expect((await move({}, )).status).toBe(200); // sanity: the key above is right
    store.clear(); seed();
    const res = await post({ fromEventId: FROM, toEventId: TO, code: CODE }, "wrong");
    expect(res.status).toBe(401);
    expect(store.get(`app/${FROM}/${LEAD}.json`).status).toBe("pending");
  });

  it("dryRun reports the plan and writes nothing", async () => {
    const res = await move({ dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.team.name).toBe("ERROR404");
    expect(res.body.moving.map((m: any) => m.email).sort()).toEqual([LEAD, MATE].sort());
    expect(store.get(`app/${TO}/${LEAD}.json`)).toBeUndefined();
    expect(store.get(`app/${FROM}/${LEAD}.json`).status).toBe("pending");
  });

  it("writes the team, the memberships and the applications at the new event", async () => {
    const res = await move();
    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(2);

    const team = store.get(`team/${TO}/${CODE}.json`);
    expect(team.eventId).toBe(TO);
    expect(team.name).toBe("ERROR404");
    expect(team.deletedAt).toBeUndefined();

    const membership = store.get(`team-member/${TO}/${MATE}.json`);
    expect(membership.code).toBe(CODE);
    expect(membership.eventId).toBe(TO);
    expect(membership.member.name).toBe("ShriRaksha K");

    const app = store.get(`app/${TO}/${LEAD}.json`);
    expect(app.eventId).toBe(TO);
    expect(app.eventName).toBe("CHAOS");
    expect(app.teamCode).toBe(CODE);
  });

  /* The whole point: nobody re-queues and nobody re-pays. */
  it("keeps the ticket, the place in the queue and the payment", async () => {
    await move();
    const app = store.get(`app/${TO}/${LEAD}.json`);
    expect(app.ticketId).toBe("PRV-KEER");
    expect(app.appliedAt).toBe("2026-09-18T09:29:52.799Z");
    expect(app.status).toBe("pending");
    expect(app.payment).toBe("awaiting");
    expect(app.paymentRef).toBe("626165961670");
    expect(store.get(`app/${TO}/${MATE}.json`).payment).toBe("not_required");
  });

  it("leaves nothing live behind at the old event", async () => {
    await move();
    expect(store.get(`team/${FROM}/${CODE}.json`).deletedAt).toBeTruthy();
    expect(store.get(`team/${FROM}/${CODE}.json`).movedTo).toEqual({ eventId: TO, code: CODE });
    /* The membership tombstone shape the rest of the app already knows. */
    expect(store.get(`team-member/${FROM}/${LEAD}.json`).code).toBe("");
    const old = store.get(`app/${FROM}/${LEAD}.json`);
    expect(old.status).toBe("cancelled");
    expect(old.movedTo).toEqual({ eventId: TO, code: CODE });
  });

  /* The reference is claimed once, against an event. Leave the claim pointing
     at the old one and re-entering it on the new event reads as somebody
     else's receipt. */
  it("re-points the payment reference claim at the new event", async () => {
    await move();
    expect(store.get("payment-ref/626165961670.json")).toMatchObject({ eventId: TO, email: LEAD });
  });

  it("refuses when somebody already has a live registration at the destination", async () => {
    store.set(`app/${TO}/${MATE}.json`, { eventId: TO, email: MATE, status: "pending", payment: "not_required" });
    const res = await move();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ShriRaksha K/);
    expect(store.get(`app/${FROM}/${LEAD}.json`).status).toBe("pending");
  });

  /* A cancelled row there is a place they gave up, not a clash. */
  it("moves over a cancelled row at the destination", async () => {
    store.set(`app/${TO}/${MATE}.json`, { eventId: TO, email: MATE, status: "cancelled", payment: "not_required" });
    const res = await move();
    expect(res.status).toBe(200);
    expect(store.get(`app/${TO}/${MATE}.json`).status).toBe("pending");
  });

  it("refuses when the destination already has that team code", async () => {
    store.set(`team/${TO}/${CODE}.json`, { code: CODE, eventId: TO, name: "Someone else" });
    const res = await move();
    expect(res.status).toBe(409);
    expect(store.get(`team/${TO}/${CODE}.json`).name).toBe("Someone else");
  });

  it("refuses a roster the destination cannot hold", async () => {
    for (const n of [3, 4, 5]) {
      const email = `extra${n}@example.com`;
      store.set(`team-member/${FROM}/${email}.json`, {
        code: CODE, eventId: FROM,
        member: { name: `Extra ${n}`, email, phone: "9000000000", college: "Aditya", joinedAt: "2026-09-18T12:00:00.000Z" },
      });
    }
    const res = await move();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/CHAOS takes teams of 2.4, and this team has 5/i);
  });

  it("refuses an unknown team or event", async () => {
    expect((await move({ code: "ZZZZZZZZZZZZ" })).status).toBe(404);
    expect((await move({ toEventId: "not-an-event" })).status).toBe(400);
    expect((await move({ toEventId: FROM })).status).toBe(400);
  });

  it("does not run twice", async () => {
    expect((await move()).status).toBe(200);
    expect((await move()).status).toBe(404);
  });
});
