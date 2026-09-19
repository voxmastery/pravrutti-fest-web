import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Path B stores the Juno registration ID the applicant pastes — the key we
   poll to auto-verify their payment. It is optional: an application without one
   just falls back to manual verification, so it never blocks the form. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null }));
vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let POST: typeof import("@/app/api/register/route").POST;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/register/route"));
});

const EVENT = "the-logic-circuit"; // solo-allowed, so these tests exercise phone/ref rules, not the team rule
const base = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  eventId: EVENT,
  paymentRef: "JUNO-TXN-1",
  ...over,
});
const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));
const stored = () => store.get(`app/${EVENT}/asha@example.com.json`);

beforeEach(() => store.clear());

describe("POST /api/register — Juno registration ID (Path B poll key)", () => {
  it("stores the registration ID, trimmed", async () => {
    expect((await post(base({ junoRegId: "  50123 " }))).status).toBe(200);
    expect(stored().junoRegId).toBe("50123");
  });

  it("is optional — an application without one still succeeds and stores null", async () => {
    expect((await post(base())).status).toBe(200);
    expect(stored().junoRegId).toBe(null);
  });
});
