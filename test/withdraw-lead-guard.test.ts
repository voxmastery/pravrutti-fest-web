import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/* Teammates pay nothing — the lead's fee covers them — so a lead who withdrew
   while they were still on the roster would leave a team nobody is paying for,
   and none of them would hear about it. */

const store = new Map<string, any>();
const members = new Map<string, any[]>();

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [] as { url: string }[],
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  listTeamMembers: async (evId: string, code: string) => members.get(`${evId}/${code}`) ?? [],
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));
vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => "lead@example.com",
  authRequired: () => true,
}));

let DELETE: typeof import("@/app/api/register/route").DELETE;
beforeAll(async () => {
  ({ DELETE } = await import("@/app/api/register/route"));
});

const EVENT = "the-logic-circuit";
const CODE = "TEAMCODE1234";
const LEAD = "lead@example.com";

const del = (body: Record<string, unknown>) =>
  DELETE(new Request("http://t/api/register", { method: "DELETE", body: JSON.stringify(body) }));

function seed(opts: { teammates: string[]; leadIsOwner?: boolean; deleted?: boolean }) {
  store.set(`app/${EVENT}/${LEAD}.json`, {
    ticketId: "PRV-LEAD", eventId: EVENT, email: LEAD, name: "Lead",
    status: "pending", payment: "awaiting", teamCode: CODE, teamName: "Bolt",
  });
  store.set(`team/${EVENT}/${CODE}.json`, {
    code: CODE, eventId: EVENT, name: "Bolt",
    createdByEmail: opts.leadIsOwner === false ? "someone@example.com" : LEAD,
    ...(opts.deleted ? { deletedAt: new Date().toISOString() } : {}),
  });
  members.set(`${EVENT}/${CODE}`, [
    { email: LEAD, name: "Lead" },
    ...opts.teammates.map((e) => ({ email: e, name: e })),
  ]);
}

beforeEach(() => { store.clear(); members.clear(); });

describe("DELETE /api/register — a lead cannot leave their team stranded", () => {
  it("refuses while a teammate is still on the roster", async () => {
    seed({ teammates: ["mate@example.com"] });
    const res = await del({ eventId: EVENT });
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).toMatch(/lead of Bolt/i);
    expect(error).toMatch(/remove them or delete the team/i);
    /* Still theirs to withdraw later, so the application must be untouched. */
    expect(store.get(`app/${EVENT}/${LEAD}.json`).status).toBe("pending");
  });

  it("counts them, so the message is not wrong about how many", async () => {
    seed({ teammates: ["a@example.com", "b@example.com"] });
    const { error } = await (await del({ eventId: EVENT })).json();
    expect(error).toMatch(/2 teammates are/);
  });

  it("lets the lead go once they are the only one left", async () => {
    seed({ teammates: [] });
    const res = await del({ eventId: EVENT });
    expect(res.status).toBe(200);
  });

  /* A joiner owes nothing and leaving strands nobody. */
  it("does not hold back someone who is not the lead", async () => {
    seed({ teammates: ["mate@example.com"], leadIsOwner: false });
    const res = await del({ eventId: EVENT });
    expect(res.status).toBe(200);
  });

  /* A deleted team has already been taken apart. */
  it("does not hold back a lead whose team is already gone", async () => {
    seed({ teammates: ["mate@example.com"], deleted: true });
    const res = await del({ eventId: EVENT });
    expect(res.status).toBe(200);
  });
});
