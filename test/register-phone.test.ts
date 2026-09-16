import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* The form's maxLength and digit stripping are cosmetic on their own — an
   application can be POSTed straight at this route. These assert the number is
   re-checked here, and that what gets stored is the normalised 10 digits the
   organisers can actually dial. */

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));

vi.mock("@/lib/identity", () => ({ resolveEmail: async () => null }));

// Registration closes on a fixed date, so leave it open rather than letting
// these fail as 409s once that date passes.
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
const KEY = `app/${EVENT}/asha@example.com.json`;

const application = (over: Record<string, unknown> = {}) => ({
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  eventId: EVENT,
  paymentRef: "JUNO-TEST-0001",
  ...over,
});

const post = (b: Record<string, unknown>) =>
  POST(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  store.clear();
});

describe("POST /api/register — lead phone", () => {
  it("accepts a valid 10-digit mobile", async () => {
    expect((await post(application())).status).toBe(200);
  });

  it("stores the normalised digits, not what was pasted", async () => {
    await post(application({ phone: "+91 98765 43210" }));
    expect(store.get(KEY).phone).toBe("9876543210");
  });

  it("rejects a number that is too long, rather than trimming it to fit", async () => {
    const res = await post(application({ phone: "98765432109999" }));
    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it("rejects a number that is too short", async () => {
    expect((await post(application({ phone: "98765" }))).status).toBe(400);
  });

  it("rejects a first digit no Indian mobile starts with", async () => {
    expect((await post(application({ phone: "1234567890" }))).status).toBe(400);
    expect((await post(application({ phone: "5876543210" }))).status).toBe(400);
  });

  it("rejects letters padded out to ten characters", async () => {
    expect((await post(application({ phone: "abcdefghij" }))).status).toBe(400);
  });

  it("rejects a missing phone", async () => {
    expect((await post(application({ phone: "" }))).status).toBe(400);
    expect((await post(application({ phone: undefined }))).status).toBe(400);
  });

  it("says what a good number looks like instead of just 'invalid'", async () => {
    const body = await (await post(application({ phone: "123" }))).json();
    expect(body.error).toMatch(/10-digit/);
    expect(body.error).toMatch(/6-9/);
  });
});

describe("POST /api/register — teammate phones", () => {
  const withMembers = (members: unknown) => application({ members });

  it("accepts a roster where everyone has a valid number", async () => {
    const res = await post(
      withMembers([
        { name: "Bhavya K", phone: "8123456789" },
        { name: "Chirag N", phone: "+91 70223 95629" },
      ])
    );
    expect(res.status).toBe(200);
    const stored = JSON.parse(store.get(KEY).members);
    expect(stored.map((m: any) => m.phone)).toEqual(["8123456789", "7022395629"]);
  });

  it("rejects the whole application when one teammate's number is junk", async () => {
    const res = await post(
      withMembers([
        { name: "Bhavya K", phone: "8123456789" },
        { name: "Chirag N", phone: "12345" },
      ])
    );
    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it("names which teammate needs fixing", async () => {
    const res = await post(withMembers([{ name: "Bhavya K", phone: "0000000000" }]));
    expect((await res.json()).error).toMatch(/Teammate 1/);
  });

  it("still takes a legacy comma-separated roster, which carries no phones", async () => {
    expect((await post(withMembers("Bhavya K, Chirag N"))).status).toBe(200);
  });
});

describe("POST /api/register — ticket ids", () => {
  it("issues a unique PRV- id to each applicant", async () => {
    expect((await post(application())).status).toBe(200);
    expect((await post(application({ name: "Bina Rao", email: "bina@example.com" }))).status).toBe(200);
    const ids = [...store.values()].map((r) => r.ticketId as string);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^PRV-[0-9A-F]{16}$/);
  });
});

describe("POST /api/register — only the team lead is charged", () => {
  const CODE = "ABCD23EFGH45";
  const teamRec = {
    code: CODE,
    eventId: EVENT,
    name: "Bolt",
    bio: "",
    createdByEmail: "lead@example.com",
    members: [],
    createdAt: "2026-09-01T00:00:00.000Z",
  };

  it("stores the payment ID a solo applicant typed", async () => {
    const res = await post(application({ paymentRef: "4183 7712 9930" }));
    expect(res.status).toBe(200);
    expect(store.get(KEY).paymentRef).toBe("4183 7712 9930");
  });

  it("charges a solo applicant the team fee once, even with a legacy roster", async () => {
    const res = await post(application({
      members: [
        { name: "Bhavya K", phone: "8123456789" },
        { name: "Chirag N", phone: "7022395629" },
      ],
    }));
    expect(res.status).toBe(200);
    const rec = store.get(KEY);
    expect(rec.payment).toBe("awaiting");
    expect(rec.fee).toBe("Rs. 200/-");
  });

  it("charges the team lead, not per teammate", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, { ...teamRec, createdByEmail: "asha@example.com" });
    store.set(`member/${EVENT}/asha@example.com.json`, { code: CODE, eventId: EVENT });
    const res = await post(application({ teamCode: CODE, paymentRef: "UTR123" }));
    expect(res.status).toBe(200);
    const rec = store.get(KEY);
    expect(rec.payment).toBe("awaiting");
    expect(rec.fee).toBe("Rs. 200/-");
    expect(rec.paymentRef).toBe("UTR123");
  });

  it("does not charge a teammate and ignores a paymentRef they send", async () => {
    store.set(`team/${EVENT}/${CODE}.json`, teamRec);
    store.set(`member/${EVENT}/asha@example.com.json`, { code: CODE, eventId: EVENT });
    const res = await post(application({ teamCode: CODE, paymentRef: "SHOULD-IGNORE" }));
    expect(res.status).toBe(200);
    const rec = store.get(KEY);
    expect(rec.payment).toBe("not_required");
    expect(rec.fee).toMatch(/lead/i);
    expect(rec.paymentRef).toBeNull();
  });
});
