import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * The broken case: lead creates a team, shares the code, submits their own
 * application — then a teammate who was not on the roster yet still joins.
 */

const store = new Map<string, any>();
const role = vi.hoisted(() => ({ current: { kind: "none" } as { kind: string; eventIds?: string[] } }));
const identity = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix = "") =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((url) => ({ url })),
  readPrivate: async () => null,
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  teamPath: (evId: string, code: string) => `team/${evId}/${code}.json`,
  teamMemberPath: (evId: string, email: string) => `member/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown, overwrite = false) => {
    if (store.has(p) && !overwrite) throw new Error("Blob already exists: overwrite not allowed");
    store.set(p, data);
  },
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([path, rec]) => path.startsWith(`member/${eventId}/`) && rec?.code === code && rec?.member)
      .map(([, rec]) => rec.member)
      .sort((a: any, b: any) => String(a.joinedAt).localeCompare(String(b.joinedAt))),
}));

vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => identity.email,
  authRequired: () => false,
}));

vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  resolveRole: async () => role.current,
}));

vi.mock("@/lib/pravrutti-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pravrutti-data")>()),
  registrationOpen: () => true,
  effectiveRegistrationOpen: () => true,
}));

let teamsPost: typeof import("@/app/api/teams/route").POST;
let teamsGet: typeof import("@/app/api/teams/route").GET;
let registerPost: typeof import("@/app/api/register/route").POST;

beforeAll(async () => {
  ({ POST: teamsPost, GET: teamsGet } = await import("@/app/api/teams/route"));
  ({ POST: registerPost } = await import("@/app/api/register/route"));
});

const lead = {
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  paymentRef: "JUNO-TEST-0001",
};

const teammate = {
  name: "Ravi Kumar",
  email: "ravi@example.com",
  phone: "9876543211",
  college: "Ramaiah Institute of Technology",
};

const postTeams = async (b: Record<string, unknown>) => {
  const res = await teamsPost(new Request("http://t/api/teams", { method: "POST", body: JSON.stringify(b) }));
  if (!res) throw new Error("expected a response");
  return res;
};

const postRegister = async (b: Record<string, unknown>) => {
  const res = await registerPost(new Request("http://t/api/register", { method: "POST", body: JSON.stringify(b) }));
  if (!res) throw new Error("expected a response");
  return res;
};

async function createAndRegisterLead(eventId = "robo-race") {
  const createdRes = await postTeams({
    action: "create",
    eventId,
    name: "Bolt",
    bio: "fast bots",
    leadName: lead.name,
    email: lead.email,
    phone: lead.phone,
    college: lead.college,
  });
  expect(createdRes.status).toBe(200);
  const created = await createdRes.json();
  expect(created.code).toMatch(/^[A-Z0-9]{6,12}$/);

  const registeredRes = await postRegister({
    ...lead,
    eventId,
    teamCode: created.code,
    teamName: created.name,
  });
  expect(registeredRes.status).toBe(200);
  const registered = await registeredRes.json();
  expect(registered.teamCode).toBe(created.code);
  expect(registered.payment).toBe("awaiting");
  expect(registered.fee).toMatch(/Rs\. 200/);
  expect(store.get(`app/${eventId}/${lead.email}.json`)).toBeTruthy();
  expect(store.get(`app/${eventId}/${lead.email}.json`).payment).toBe("awaiting");

  return created as { code: string; name: string; memberCount: number; maxMembers: number; isFull: boolean };
}

beforeEach(() => {
  store.clear();
  role.current = { kind: "none" };
  identity.email = null;
});

describe("POST /api/teams join after the lead has registered", () => {
  it("lets a new teammate join with the code after the lead submits", async () => {
    const created = await createAndRegisterLead();
    expect(created.isFull).toBe(false);

    const joinRes = await postTeams({
      action: "join",
      eventId: "robo-race",
      code: created.code,
      ...teammate,
    });
    expect(joinRes.status).toBe(200);
    const joined = await joinRes.json();
    expect(joined.teamCode).toBe(created.code);
    expect(joined.ticketId).toMatch(/^PRV-/);
    expect(joined.payment).toBe("not_required");
    expect(joined.fee).toMatch(/lead/i);
    expect(store.get(`app/robo-race/${teammate.email}.json`)).toBeTruthy();
    expect(store.get(`app/robo-race/${teammate.email}.json`).payment).toBe("not_required");
    expect(store.get(`app/robo-race/${teammate.email}.json`).paymentRef).toBeUndefined();
    expect(store.get(`member/robo-race/${teammate.email}.json`)?.code).toBe(created.code);
  });

  it("still returns the same code from mine after the lead has submitted", async () => {
    const created = await createAndRegisterLead();
    identity.email = lead.email;
    const res = await teamsGet(new Request(`http://t/api/teams?event=robo-race&mine=1`));
    if (!res) throw new Error("expected a response");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team?.code).toBe(created.code);
    expect(body.team?.isFull).toBe(false);
    expect(body.team?.members).toEqual([
      { name: lead.name, email: lead.email, status: "joined" },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/9876543210/);
  });

  it("mine lists later joiners by name and email, not phone", async () => {
    const created = await createAndRegisterLead();
    const joinRes = await postTeams({
      action: "join",
      eventId: "robo-race",
      code: created.code,
      ...teammate,
    });
    expect(joinRes.status).toBe(200);

    identity.email = lead.email;
    const res = await teamsGet(new Request(`http://t/api/teams?event=robo-race&mine=1`));
    if (!res) throw new Error("expected a response");
    const body = await res.json();
    expect(body.team?.members).toEqual([
      { name: lead.name, email: lead.email, status: "joined" },
      { name: teammate.name, email: teammate.email, status: "joined" },
    ]);
    expect(JSON.stringify(body.team.members)).not.toMatch(/phone/i);
    expect(JSON.stringify(body)).not.toMatch(/987654321/);
  });

  it("does not leak teammate emails when verifying a code", async () => {
    const created = await createAndRegisterLead();
    const res = await teamsGet(
      new Request(`http://t/api/teams?event=robo-race&code=${encodeURIComponent(created.code)}`)
    );
    if (!res) throw new Error("expected a response");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toBeUndefined();
    expect(body.code).toBe(created.code);
    expect(JSON.stringify(body)).not.toMatch(/@example\.com/i);
    expect(JSON.stringify(body)).not.toMatch(/987654321/);
  });

  it("rejects join once the event's teamSize.max is reached", async () => {
    const created = await createAndRegisterLead("glide-x");
    expect(created.maxMembers).toBe(2);

    const first = await postTeams({
      action: "join",
      eventId: "glide-x",
      code: created.code,
      ...teammate,
    });
    expect(first.status).toBe(200);

    const second = await postTeams({
      action: "join",
      eventId: "glide-x",
      code: created.code,
      name: "Meera Shah",
      email: "meera@example.com",
      phone: "9876543212",
      college: "Ramaiah Institute of Technology",
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toMatch(/full/i);
    expect(store.get("app/glide-x/meera@example.com.json")).toBeUndefined();
  });

  it("does not let a code from another event join this one", async () => {
    const created = await createAndRegisterLead("robo-race");
    const res = await postTeams({
      action: "join",
      eventId: "line-follower",
      code: created.code,
      ...teammate,
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no team/i);
    expect(store.get(`app/line-follower/${teammate.email}.json`)).toBeUndefined();
  });
});
