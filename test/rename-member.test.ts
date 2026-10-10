import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Correcting a name on a team.
 *
 * The lead can edit anyone on the roster. A member can edit only their own.
 * The membership row and the application (when there is one) both change,
 * and the edit is stamped. A checked-in name, and a declined or cancelled
 * entry, stay as they are.
 */

const store = new Map<string, any>();
const identity = vi.hoisted(() => ({ email: null as string | null }));
const open = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix = "") =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((url) => ({ url })),
  readPrivate: async () => null,
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  paymentRefPath: (ref: string) => "payment-ref/" + ref.trim().toLowerCase() + ".json",
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `member/${e}/${m}.json`,
  invitePath: (t: string) => `invite/${t}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, d: unknown, ow?: boolean) => {
    if (store.has(p) && !ow) throw new Error("Blob already exists: overwrite not allowed");
    store.set(p, d);
  },
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([path, rec]) => path.startsWith(`member/${eventId}/`) && rec?.code === code && rec?.member)
      .map(([, rec]) => rec.member),
}));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => identity.email, authRequired: () => true }));
vi.mock("@/lib/roles", () => ({
  resolveRole: async () => ({ kind: "none" }),
  resolveRoleFor: async () => ({ kind: "none" }),
}));
vi.mock("@/lib/pravrutti-data", async (o) => ({
  ...(await o<typeof import("@/lib/pravrutti-data")>()),
  effectiveRegistrationOpen: () => open.value,
}));
vi.mock("@/lib/invite-email", () => ({
  inviteUrl: (t: string) => `https://pravrutti.tech/invite/${t}`,
  sendInviteEmail: async () => ({ sent: true }),
}));
vi.mock("@/lib/confirmation-email", () => ({ sendConfirmationEmail: async () => ({ sent: true }) }));

let POST: typeof import("@/app/api/teams/route").POST;
beforeAll(async () => { ({ POST } = await import("@/app/api/teams/route")); });

const EV = "zero-hour";
const CODE = "CODEFULL1111";
const LEAD = "lead@example.com";
const MATE = "mate@example.com";
const AT = "2026-10-09T04:25:00.000Z";

const post = async (b: Record<string, unknown>) => {
  const res = (await POST(new Request("http://t/api/teams", {
    method: "POST", body: JSON.stringify(b),
  }))) as Response;
  return { status: res.status, body: await res.json() };
};

const rename = (memberEmail: string, name: string) =>
  post({ action: "rename_member", eventId: EV, code: CODE, memberEmail, name });

function member(email: string, name: string, extra: Record<string, unknown> = {}) {
  store.set(`member/${EV}/${email}.json`, {
    code: CODE, eventId: EV,
    member: { name, email, phone: "9800000000", college: "RVCE", joinedAt: AT, ...extra },
  });
}

function app(email: string, name: string, extra: Record<string, unknown> = {}) {
  store.set(`app/${EV}/${email}.json`, {
    ticketId: "PRV-TEST", eventId: EV, eventName: "ZERO HOUR", status: "pending",
    payment: "not_required", fee: "Rs. 0", name, email, phone: "9800000000", college: "RVCE",
    teamName: "CODE RED", teamCode: CODE, appliedAt: AT, ...extra,
  });
}

beforeEach(() => {
  store.clear();
  identity.email = null;
  open.value = true;
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE, eventId: EV, name: "CODE RED", bio: "", createdByEmail: LEAD, members: [], createdAt: AT,
  });
  member(LEAD, "Lingesh");
  member(MATE, "Mir");
  app(LEAD, "Lingesh");
  app(MATE, "Mir");
});

describe("rename_member", () => {
  it("lets the lead rename a teammate, on the roster and on the application", async () => {
    identity.email = LEAD;
    const res = await rename(MATE, "  Mira   K  ");
    expect(res.status).toBe(200);
    const row = store.get(`member/${EV}/${MATE}.json`).member;
    expect(row.name).toBe("Mira K");
    expect(row.renamedBy).toBe(LEAD);
    expect(row.renamedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get(`app/${EV}/${MATE}.json`).name).toBe("Mira K");
  });

  it("lets the lead rename themself", async () => {
    identity.email = LEAD;
    const res = await rename(LEAD, "Lingesh G");
    expect(res.status).toBe(200);
    expect(store.get(`member/${EV}/${LEAD}.json`).member.name).toBe("Lingesh G");
    expect(store.get(`app/${EV}/${LEAD}.json`).name).toBe("Lingesh G");
  });

  it("lets a member rename only themself", async () => {
    identity.email = MATE;
    expect((await rename(MATE, "Mir S")).status).toBe(200);
    expect(store.get(`app/${EV}/${MATE}.json`).name).toBe("Mir S");
    const other = await rename(LEAD, "Not Lingesh");
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("You can only change your own name.");
    expect(store.get(`app/${EV}/${LEAD}.json`).name).toBe("Lingesh");
  });

  it("refuses a stranger", async () => {
    identity.email = "stranger@example.com";
    const res = await rename(MATE, "Mir S");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("You can only change your own name.");
  });

  it("asks them to sign in", async () => {
    expect((await rename(MATE, "Mir S")).status).toBe(401);
  });

  it("refuses a name that is too short or too long", async () => {
    identity.email = LEAD;
    expect((await rename(MATE, "A")).status).toBe(400);
    expect((await rename(MATE, "A")).body.error).toBe("Enter a name (2–80 characters).");
    expect((await rename(MATE, "A".repeat(81))).status).toBe(400);
    expect((await rename(MATE, "Jo")).status).toBe(200);
  });

  it("locks a name after check-in", async () => {
    identity.email = LEAD;
    app(MATE, "Mir", { checkedInAt: AT });
    const res = await rename(MATE, "Mira K");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Names lock after check-in.");
    expect(store.get(`member/${EV}/${MATE}.json`).member.name).toBe("Mir");
  });

  it("locks a name that is not confirmed", async () => {
    identity.email = LEAD;
    for (const status of ["declined", "cancelled"] as const) {
      app(MATE, "Mir", { status });
      const res = await rename(MATE, "Mira K");
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Not confirmed: team changes are locked.");
    }
    expect(store.get(`member/${EV}/${MATE}.json`).member.name).toBe("Mir");
  });

  it("renames an invited person who has no application yet", async () => {
    identity.email = LEAD;
    const invited = "invited@example.com";
    member(invited, "Invited Pal", { invitedAt: AT });
    store.delete(`app/${EV}/${invited}.json`);
    const res = await rename(invited, "Pal K");
    expect(res.status).toBe(200);
    expect(store.get(`member/${EV}/${invited}.json`).member.name).toBe("Pal K");
    expect(store.has(`app/${EV}/${invited}.json`)).toBe(false);
  });

  it("tells the person looking when registration has closed, before they join", async () => {
    open.value = false;
    identity.email = "stranger@example.com";
    const res = await post({ action: "verify", eventId: EV, code: CODE });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/closed/i);
  });
});
