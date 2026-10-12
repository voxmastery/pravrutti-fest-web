import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Redirects out of the invite route were built from req.url. Behind the
   production server that is the internal bind address, so an accepted invite
   was recorded and then sent the person to https://0.0.0.0:3000 — a page that
   does not resolve, leaving them certain it had failed. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  /* The invite route checks whether the event is full, which lists the
     event's registrations. */
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
  putJson: async (p: string, d: unknown) => { store.set(p, d); },
}));
vi.mock("@/lib/mailer", () => ({ siteOrigin: () => "https://pravrutti.tech" }));
vi.mock("@/lib/pravrutti-data", async (o) => {
  const actual = await o<typeof import("@/lib/pravrutti-data")>();
  return {
    ...actual,
    /* BRIDGE IT is closed on the live list. This file is about the redirect. */
    events: actual.events.map((e) =>
      actual.eventId(e.name) === "bridge-it" ? { ...e, full: false } : e,
    ),
  };
});

let GET: typeof import("@/app/invite/[token]/route").GET;
beforeAll(async () => { ({ GET } = await import("@/app/invite/[token]/route")); });

const TOKEN = "a".repeat(64);
const EV = "bridge-it", CODE = "TEAMCCCC3333", MATE = "mate@example.com";
/* The address the server reports internally, which is what made this wrong. */
const INTERNAL = `https://0.0.0.0:3000/invite/${TOKEN}`;

const open = (token = TOKEN) =>
  GET(new Request(INTERNAL), { params: Promise.resolve({ token }) });

beforeEach(() => store.clear());

describe("where an invite sends somebody", () => {
  it("sends a dead invite to a page that resolves", async () => {
    const res = await open();
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe("https://pravrutti.tech");
    expect(to.pathname).toBe("/invite/problem");
  });

  it("sends an accepted invite to their team, not to the bind address", async () => {
    store.set(`invite/${TOKEN}.json`, {
      token: TOKEN, eventId: EV, code: CODE, email: MATE, createdAt: new Date().toISOString(),
    });
    store.set(`team/${EV}/${CODE}.json`, {
      code: CODE, eventId: EV, name: "Bolt", bio: "", createdByEmail: "lead@example.com",
      members: [], createdAt: new Date().toISOString(),
    });
    store.set(`member/${EV}/${MATE}.json`, {
      code: CODE, eventId: EV,
      member: { name: "A Mate", email: MATE, phone: "9876543210", college: "RUAS",
                joinedAt: new Date().toISOString(), invitedAt: new Date().toISOString(), inviteToken: TOKEN },
    });

    const res = await open();
    const to = new URL(res.headers.get("location")!);
    expect(to.origin).toBe("https://pravrutti.tech");
    expect(to.pathname).toBe(`/teams/${EV}/${CODE}`);
    /* And the acceptance really happened — the redirect is the only thing
       that was ever broken. */
    expect(store.get(`member/${EV}/${MATE}.json`).member.acceptedAt).toBeTruthy();
  });

  it("never points anyone at the internal address", async () => {
    const res = await open("short");
    expect(res.headers.get("location")).not.toMatch(/0\.0\.0\.0/);
  });
});
