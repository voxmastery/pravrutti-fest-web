import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The certificate read has to notice a checked-in teammate, not only the lead.
 * Eligibility is pure; this is the load that used to stop at the lead's row.
 */

const store = new Map<string, unknown>();
const who = vi.hoisted(() => ({ email: "nithya@example.com" }));

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (eventId: string, email: string) => `app/${eventId}/${email}.json`,
  teamPath: (eventId: string, code: string) => `team/${eventId}/${code}.json`,
  teamMemberPath: (eventId: string, email: string) => `member/${eventId}/${email}.json`,
  readJsonByPath: async (path: string) => store.get(path) ?? null,
  listTeamMembers: async (eventId: string, code: string) =>
    [...store.entries()]
      .filter(([path, row]) => {
        const record = row as { code?: string; member?: unknown };
        return path.startsWith(`member/${eventId}/`) && record?.code === code && record.member;
      })
      .map(([, row]) => (row as { member: unknown }).member),
}));

vi.mock("@/lib/identity", () => ({ resolveEmail: async () => who.email }));
vi.mock("@/lib/sql-store", () => ({ sqlEnabled: () => true }));
vi.mock("@/lib/certificate-feedback", () => ({
  feedbackStore: () => ({ get: async () => null, list: async () => [] }),
}));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => ({ kind: "none" }) }));

const EV = "triathlon";
const CODE = "BYTEFORGE01";

function app(email: string, over: Record<string, unknown>) {
  store.set(`app/${EV}/${email}.json`, {
    eventId: EV,
    email,
    name: email,
    status: "confirmed",
    teamCode: CODE,
    checkedInAt: null,
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  who.email = "nithya@example.com";
  store.set(`team/${EV}/${CODE}.json`, {
    code: CODE,
    eventId: EV,
    name: "Byteforge",
    createdByEmail: "lead@example.com",
  });
  store.set(`member/${EV}/nithya@example.com.json`, {
    code: CODE,
    member: { email: "nithya@example.com", name: "Nithyashree G" },
  });
  store.set(`member/${EV}/parinitha@example.com.json`, {
    code: CODE,
    member: { email: "parinitha@example.com", name: "Parinitha TG" },
  });
  store.set(`member/${EV}/lead@example.com.json`, {
    code: CODE,
    member: { email: "lead@example.com", name: "Lead" },
  });
  app("nithya@example.com", { name: "Nithyashree G", checkedInAt: null });
  app("lead@example.com", { name: "Lead", checkedInAt: null });
  app("parinitha@example.com", { name: "Parinitha TG", checkedInAt: "2026-10-14T04:00:00.000Z" });
});

describe("certificate status from a teammate's check-in", () => {
  it("qualifies a confirmed teammate when someone else on the team is checked in", async () => {
    const { certificateStatus } = await import("@/lib/certificate-service");
    const status = await certificateStatus();
    expect(status).toEqual({ ok: true, eligible: true, submitted: false });
  });

  it("does not count a declined teammate's stamp", async () => {
    app("parinitha@example.com", { status: "declined", checkedInAt: "2026-10-14T04:00:00.000Z" });
    const { certificateStatus } = await import("@/lib/certificate-service");
    const status = await certificateStatus();
    expect(status).toEqual({ ok: true, eligible: false, submitted: false });
  });

  it("does not count a deleted team", async () => {
    store.set(`team/${EV}/${CODE}.json`, {
      code: CODE,
      eventId: EV,
      name: "Byteforge",
      createdByEmail: "lead@example.com",
      deletedAt: "2026-10-20T00:00:00.000Z",
    });
    const { certificateStatus } = await import("@/lib/certificate-service");
    const status = await certificateStatus();
    expect(status).toEqual({ ok: true, eligible: false, submitted: false });
  });
});
