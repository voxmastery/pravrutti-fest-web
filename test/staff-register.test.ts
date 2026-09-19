import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const store = new Map<string, unknown>();
const role = vi.hoisted(() => ({ current: { kind: "none" } as { kind: string; eventIds?: string[] } }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => {
    store.set(p, data);
  },
}));

vi.mock("@/lib/identity", () => ({
  resolveEmail: async () =>
    role.current.kind === "none" ? null : "boss@pravrutti.test", authRequired: () => false }));

vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));

vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/register/route"));
});

const application = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  eventId: "the-logic-circuit", // solo-allowed: this test is about staff, not the team rule
  paymentRef: "JUNO-TEST-0001",
  ...over,
});

const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  store.clear();
  role.current = { kind: "none" };
});

describe("POST /api/register — staff cannot apply", () => {
  it("rejects an organiser with 403", async () => {
    role.current = { kind: "organiser" };
    const res = await post(application());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/staff/i);
    expect(store.size).toBe(0);
  });

  it("rejects a coordinator with 403", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-race"] };
    const res = await post(application());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/staff/i);
    expect(store.size).toBe(0);
  });

  it("rejects a coordinator email even when the session has no role", async () => {
    const res = await post(application({ email: "arbharaath@gmail.com" }));
    expect(res.status).toBe(403);
    expect(store.size).toBe(0);
  });

  it("still accepts a regular student", async () => {
    expect((await post(application())).status).toBe(200);
    expect([...store.keys()].filter((k) => k.startsWith("app/"))).toHaveLength(1);
  });
});
