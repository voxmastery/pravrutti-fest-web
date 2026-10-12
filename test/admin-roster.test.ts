import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Both views of an event's roster, side by side, for the desk to check.
 *
 * A coordinator rang to say they could see a team's lead and nobody else.
 * Whether that is the data or the dashboard can't be told from a phone
 * call, and the organisers' own session can't see what a coordinator sees.
 * So this builds the roster exactly as the dashboard does, once for each
 * kind of viewer, behind the admin key.
 */

const store = new Map<string, any>();
vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k, pathname: k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
}));

let GET: typeof import("@/app/api/admin/roster/route").GET;
beforeAll(async () => {
  process.env.ADMIN_KEY = "test-admin-key";
  ({ GET } = await import("@/app/api/admin/roster/route"));
});

const EV = "line-follower";
const get = async (query: string, key: string | null = "test-admin-key") => {
  const headers: Record<string, string> = {};
  if (key) headers["x-admin-key"] = key;
  const res = await GET(new Request(`http://t/api/admin/roster?${query}`, { headers }));
  return { status: res.status, body: await res.json() };
};
const app = (email: string, over: Record<string, unknown>) =>
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-1", eventId: EV, eventName: "LINE FOLLOWER", name: email.split("@")[0], email,
    phone: "9000000000", college: "RUAS", members: null, appliedAt: "2026-10-01T00:00:00.000Z",
    teamName: "Beetle", teamCode: "BEETLE000001", ...over,
  });

beforeEach(() => {
  store.clear();
  /* A confirmed team, and a teammate whose lead never registered — the
     one kind of entry an organiser sees and a coordinator doesn't. */
  app("lead@x.com", { status: "confirmed", payment: "paid", fee: "Rs. 200/-" });
  app("mate@x.com", { status: "confirmed", payment: "not_required", fee: "Covered by team lead" });
  app("other@x.com", { status: "pending", payment: "not_required", fee: "Covered by team lead", teamName: "Moth", teamCode: "MOTH00000001" });
});

describe("GET /api/admin/roster", () => {
  it("is closed without the admin key", async () => {
    expect((await get(`eventId=${EV}`, null)).status).toBe(401);
  });

  it("refuses an event that does not exist", async () => {
    expect((await get("eventId=no-such-event")).status).toBe(404);
  });

  it("returns the roster as an organiser sees it, and as a coordinator does", async () => {
    const { status, body } = await get(`eventId=${EV}`);
    expect(status).toBe(200);
    expect(body.organiser.roster.map((r: any) => r.email).sort()).toEqual(["lead@x.com", "mate@x.com", "other@x.com"]);
    expect(body.coordinator.roster.map((r: any) => r.email).sort()).toEqual(["lead@x.com", "mate@x.com"]);
  });

  it("gives the coordinator view no payment record", async () => {
    const { body } = await get(`eventId=${EV}`);
    expect(body.coordinator.roster.every((r: any) => !("payment" in r) && !("paymentRef" in r))).toBe(true);
  });

  it("returns each view's headline counts, which agree", async () => {
    const { body } = await get(`eventId=${EV}`);
    expect(body.organiser.counts.teams).toBe(1);
    expect(body.coordinator.counts.teams).toBe(1);
  });

  it("shows a coordinator confirmed teams only", async () => {
    /* A lead whose payment is in review holds a place, and an organiser
       sees them — a coordinator does not, nor any in-review number. */
    app("pending@x.com", { status: "pending", payment: "paid", fee: "Rs. 200/-", teamName: "Wasp", teamCode: "WASP00000001" });
    const { body } = await get(`eventId=${EV}`);
    expect(body.organiser.roster.map((r: any) => r.email)).toContain("pending@x.com");
    expect(body.organiser.counts.inReviewTeams).toBe(1);
    expect(body.coordinator.roster.every((r: any) => r.status === "confirmed")).toBe(true);
    expect(body.coordinator.counts).toMatchObject({ teams: 1, registered: 2, inReview: 0, inReviewTeams: 0 });
  });
});
