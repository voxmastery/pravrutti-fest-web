import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({ map: new Map<string, unknown>(), order: [] as string[] }));
vi.mock("@/lib/blob-store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/blob-store")>();
  const listAll = async (prefix: string) =>
    [...db.map.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: `sql://${k}` }));
  return {
    ...real,
    listAll,
    readJsonByPath: async (p: string) => db.map.get(p) ?? null,
    readPrivate: async (u: string) => db.map.get(u.replace("sql://", "")) ?? null,
    putJson: async (p: string, d: unknown, overwrite: boolean) => {
      if (!overwrite && db.map.has(p)) throw new Error("exists");
      db.order.push(`put:${p}`);
      db.map.set(p, d);
    },
    deleteJson: async (p: string) => {
      db.order.push(`del:${p}`);
      db.map.delete(p);
    },
    listTeamMembers: async (ev: string, code: string) =>
      (await listAll(`team-member/${ev}/`))
        .map((r) => db.map.get(r.pathname) as any)
        .filter((r) => r?.code === code)
        .map((r) => r.member),
  };
});

import { applicationPath, teamMemberPath, paymentRefPath, gatePath, emailScopedKey } from "@/lib/blob-store";
import { planPurge, executePurge, parseEmails } from "@/lib/purge";

const T = "roppashreeganesh@gmail.com";
const EV = "triathlon";

function seedTestTeam(extraMember?: string) {
  db.map.set(applicationPath(EV, T), { eventId: EV, email: T, status: "confirmed", paymentRef: "JUNO12345678" });
  db.map.set(paymentRefPath("JUNO12345678"), { eventId: EV, email: T });
  db.map.set(teamMemberPath(EV, T), { code: "ABCDEF123456", member: { email: T, name: "G" } });
  db.map.set(`team/${EV}/ABCDEF123456.json`, { code: "ABCDEF123456", eventId: EV, name: "Test", createdByEmail: T });
  db.map.set(`reminder/${emailScopedKey(EV, T)}/1.json`, { at: "x" });
  db.map.set(gatePath(T), { at: "x" });
  if (extraMember) db.map.set(teamMemberPath(EV, extraMember), { code: "ABCDEF123456", member: { email: extraMember, name: "Real" } });
}

beforeEach(() => {
  db.map.clear();
  db.order.length = 0;
});

describe("parseEmails", () => {
  it("splits on lines, commas and spaces, lowercases, drops junk and repeats", () => {
    expect(parseEmails("A@x.in, a@x.in\nnot-an-email  b@y.com")).toEqual(["a@x.in", "b@y.com"]);
  });
});

describe("planPurge", () => {
  it("finds every record stored against the address", async () => {
    seedTestTeam();
    const plan = await planPurge([T]);
    expect(plan.blockers).toEqual([]);
    expect(plan.items.map((i) => i.kind).sort()).toEqual(
      ["gate", "payment-ref", "registration", "reminder", "team", "team-membership"].sort()
    );
  });

  it("refuses when a real person is on a team the test account leads", async () => {
    seedTestTeam("student@college.edu");
    const plan = await planPurge([T]);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0]).toContain("student@college.edu");
    expect(plan.items.some((i) => i.kind === "team")).toBe(false);
  });

  it("allows it once that teammate is on the list too", async () => {
    seedTestTeam("fantasygamer.no.1@gmail.com");
    const plan = await planPurge([T, "fantasygamer.no.1@gmail.com"]);
    expect(plan.blockers).toEqual([]);
    expect(plan.items.some((i) => i.kind === "team")).toBe(true);
  });

  it("reports an address with nothing stored", async () => {
    expect((await planPurge(["nobody@x.in"])).notFound).toEqual(["nobody@x.in"]);
  });

  it("leaves a transaction ID claimed by someone else alone", async () => {
    seedTestTeam();
    db.map.set(paymentRefPath("JUNO12345678"), { eventId: EV, email: "other@x.in" });
    const plan = await planPurge([T]);
    expect(plan.items.some((i) => i.kind === "payment-ref")).toBe(false);
  });
});

describe("executePurge", () => {
  it("saves a copy before deleting anything, then deletes it all", async () => {
    seedTestTeam();
    const plan = await planPurge([T]);
    const out = await executePurge(plan, "org@x.in");
    expect(out.deleted).toBe(plan.items.length);
    expect(db.order[0]).toBe(`put:${out.log}`);
    const log = db.map.get(out.log) as any;
    expect(log.by).toBe("org@x.in");
    expect(log.records).toHaveLength(plan.items.length);
    expect([...db.map.keys()]).toEqual([out.log]);
  });
});

describe("withoutBlocked", () => {
  it("keeps every record of a lead whose team has a real person, removes the rest", async () => {
    seedTestTeam("student@college.edu");
    const other = "ganesh.s0ga@gmail.com";
    db.map.set(applicationPath("robo-race", other), { eventId: "robo-race", email: other, status: "confirmed" });
    const { withoutBlocked } = await import("@/lib/purge");
    const safe = withoutBlocked(await planPurge([T, other]));
    const paths = safe.items.map((i) => i.path);
    expect(paths).toContain(applicationPath("robo-race", other));
    expect(paths).not.toContain(applicationPath(EV, T));
    expect(paths).not.toContain(teamMemberPath(EV, T));
  });
});

describe("runDemoCleanup", () => {
  it("runs once, even when started twice", async () => {
    db.map.set(applicationPath("robo-race", "roppashreeganesh@gmail.com"), { eventId: "robo-race", email: "roppashreeganesh@gmail.com", status: "confirmed" });
    const { runDemoCleanup, DEMO_CLEANUP_MARKER } = await import("@/lib/demo-cleanup");
    const [a, b] = await Promise.all([runDemoCleanup(), runDemoCleanup()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((db.map.get(DEMO_CLEANUP_MARKER) as any).state).toBe("done");
    expect((db.map.get(DEMO_CLEANUP_MARKER) as any).deleted).toBe(1);
    expect(db.map.has(applicationPath("robo-race", "roppashreeganesh@gmail.com"))).toBe(false);
    expect(await runDemoCleanup()).toBeNull();
  });
});
