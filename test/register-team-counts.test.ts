import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The seat counter reports teams for events whose field is stated that way.
   There is one application per person, so a four-person team is four rows —
   counting rows would claim four teams and show the event full at a quarter of
   its real size. Distinct team codes, plus one per solo entry, is the figure. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: `mem:${k}` })),
  readPrivate: async (url: string) => store.get(url.replace(/^mem:/, "")) ?? null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null }));

let GET: typeof import("@/app/api/register/route").GET;
beforeAll(async () => {
  ({ GET } = await import("@/app/api/register/route"));
});

const EV = "robo-race";
const app = (email: string, teamCode: string | null, status = "confirmed") => ({
  ticketId: `PRV-${email}`, eventId: EV, eventName: "ROBO RACE",
  status, payment: "paid", fee: "Rs. 200/-",
  name: email, email, phone: "9876543210", college: "C",
  teamName: teamCode ? "T" : null, teamCode, members: null,
  appliedAt: "2026-09-01T00:00:00.000Z",
});
const put = (a: ReturnType<typeof app>) => store.set(`app/${EV}/${a.email}.json`, a);

const counts = async () => {
  const res = await GET(new Request("http://t/api/register"));
  return res.json();
};

beforeEach(() => store.clear());

describe("GET /api/register — team counts", () => {
  it("counts a four-person team as one team, not four", async () => {
    for (const n of ["a", "b", "c", "d"]) put(app(`${n}@e.com`, "ROBOCODE1234"));
    const d = await counts();
    expect(d.confirmed[EV]).toBe(4);      // four people
    expect(d.confirmedTeams[EV]).toBe(1); // one team
  });

  it("counts each solo entry as its own team", async () => {
    put(app("solo1@e.com", null));
    put(app("solo2@e.com", null));
    expect((await counts()).confirmedTeams[EV]).toBe(2);
  });

  it("adds teams and solos together", async () => {
    put(app("a@e.com", "CODEAAAAAAAA"));
    put(app("b@e.com", "CODEAAAAAAAA"));
    put(app("c@e.com", "CODEBBBBBBBB"));
    put(app("solo@e.com", null));
    const d = await counts();
    expect(d.confirmed[EV]).toBe(4);
    expect(d.confirmedTeams[EV]).toBe(3); // two teams + one solo
  });

  it("keeps pending teams separate from confirmed ones", async () => {
    put(app("a@e.com", "CODEAAAAAAAA", "confirmed"));
    put(app("b@e.com", "CODEBBBBBBBB", "pending"));
    put(app("c@e.com", "CODEBBBBBBBB", "pending"));
    const d = await counts();
    expect(d.confirmedTeams[EV]).toBe(1);
    expect(d.pendingTeams[EV]).toBe(1);
  });

  /* A cancelled or declined entry frees its place, so it must not be counted. */
  it("ignores entries that are neither confirmed nor pending", async () => {
    put(app("a@e.com", "CODEAAAAAAAA", "cancelled"));
    put(app("b@e.com", "CODEBBBBBBBB", "declined"));
    const d = await counts();
    expect(d.confirmedTeams[EV] ?? 0).toBe(0);
    expect(d.pendingTeams[EV] ?? 0).toBe(0);
  });
});
