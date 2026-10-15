import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOCS_COPY,
  hacktivateDemoPath,
  normalizeDriveUrl,
  validateDriveUrl,
} from "@/lib/hacktivate-docs";
import { canManageTrackPick, HACKTIVATE_EVENT_ID } from "@/lib/track-pick";

const EVENT = HACKTIVATE_EVENT_ID;

describe("hacktivate demo Drive helpers", () => {
  it("normalises Google Drive links and rejects other hosts", () => {
    expect(normalizeDriveUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe(
      "https://drive.google.com/file/d/abc123/view",
    );
    expect(normalizeDriveUrl("drive.google.com/open?id=xyz")).toBe(
      "https://drive.google.com/open?id=xyz",
    );
    expect(normalizeDriveUrl("https://docs.google.com/presentation/d/abc/edit")).toMatch(
      /^https:\/\/docs\.google\.com\//,
    );
    expect(normalizeDriveUrl("https://dropbox.com/s/x")).toBeNull();
    expect(normalizeDriveUrl("not a url")).toBeNull();
    expect(normalizeDriveUrl("")).toBeNull();
  });

  it("validates empty vs bad vs good links", () => {
    expect(validateDriveUrl("")).toMatchObject({ ok: false, code: "empty", message: DOCS_COPY.empty });
    expect(validateDriveUrl("https://example.com/x")).toMatchObject({
      ok: false,
      code: "bad_link",
      message: DOCS_COPY.badLink,
    });
    const good = validateDriveUrl("https://drive.google.com/file/d/abc/view");
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.driveUrl).toContain("drive.google.com");
  });

  it("builds one storage path per team", () => {
    expect(hacktivateDemoPath("byteforge01")).toBe("hacktivate-demo/BYTEFORGE01.json");
  });

  it("reuses Track Pick staff gate for Ganesh and Shravanth", () => {
    expect(canManageTrackPick({ kind: "organiser" })).toBe(true);
    expect(canManageTrackPick({ kind: "coordinator", eventIds: ["hacktivate"] })).toBe(true);
    expect(canManageTrackPick({ kind: "coordinator", eventIds: ["chaos"] })).toBe(false);
  });
});

const store = new Map<string, unknown>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m.toLowerCase()}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m.toLowerCase()}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => {
    store.set(p, data);
  },
  deleteJson: async (p: string) => {
    store.delete(p);
  },
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: `mem:${k}`, pathname: k })),
  readPrivate: async (url: string) => store.get(String(url).replace(/^mem:/, "")) ?? null,
}));

const session = {
  email: null as string | null,
  name: null as string | null,
  role: { kind: "none", eventIds: [] as string[] },
};

vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => session.email,
  resolveDisplayName: async () => session.name,
}));

vi.mock("@/lib/roles", () => ({
  resolveRole: async () => session.role,
}));

function seedTeam(opts: {
  code: string;
  name: string;
  leadEmail: string;
  leadName?: string;
  status?: string;
  members?: { email: string; name: string; status?: string }[];
}) {
  store.set(`team/${EVENT}/${opts.code}.json`, {
    code: opts.code,
    eventId: EVENT,
    name: opts.name,
    bio: "",
    createdByEmail: opts.leadEmail,
    members: [],
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  const people = [
    { email: opts.leadEmail, name: opts.leadName ?? "Lead", status: opts.status ?? "confirmed" },
    ...(opts.members ?? []),
  ];
  for (const person of people) {
    const key = person.email.trim().toLowerCase();
    store.set(`team-member/${EVENT}/${key}.json`, {
      code: opts.code,
      eventId: EVENT,
      member: {
        name: person.name,
        email: person.email,
        phone: "9876543210",
        college: "RUAS",
        joinedAt: "2026-10-01T00:00:00.000Z",
      },
    });
    store.set(`app/${EVENT}/${key}.json`, {
      ticketId: "PRV-T",
      eventId: EVENT,
      eventName: "Hacktivate",
      status: person.status ?? "confirmed",
      payment: "paid",
      fee: "Rs. 200/-",
      name: person.name,
      email: person.email,
      phone: "9876543210",
      college: "RUAS",
      teamName: opts.name,
      teamCode: opts.code,
      members: null,
      appliedAt: "2026-10-01T00:00:00.000Z",
    });
  }
}

describe("hacktivate demo service", () => {
  beforeEach(() => {
    store.clear();
    session.email = null;
    session.name = null;
    session.role = { kind: "none", eventIds: [] };
  });

  it("lets a confirmed teammate submit, lists for staff, and replaces on resubmit", async () => {
    const {
      submitDemoLink,
      getParticipantDemo,
      getStaffDemoBoard,
      clearDemoLink,
    } = await import("@/lib/hacktivate-docs-service");

    seedTeam({
      code: "BYTEFORGE01",
      name: "ByteForge",
      leadEmail: "lead@byteforge.test",
      leadName: "Arjun",
      members: [{ email: "mate@byteforge.test", name: "Riya" }],
    });

    session.email = "mate@byteforge.test";
    session.name = "Riya S";

    const before = await getParticipantDemo("mate@byteforge.test");
    expect(before.canSubmit).toBe(true);
    expect(before.demo).toBeNull();

    const up = await submitDemoLink(
      "mate@byteforge.test",
      "https://drive.google.com/file/d/abc123/view?usp=sharing",
    );
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.demo.teamCode).toBe("BYTEFORGE01");
    expect(up.demo.driveUrl).toBe("https://drive.google.com/file/d/abc123/view");

    const board = await getStaffDemoBoard();
    expect(board.total).toBe(1);
    expect(board.demos[0]?.teamName).toBe("ByteForge");

    const again = await submitDemoLink(
      "mate@byteforge.test",
      "https://drive.google.com/file/d/xyz999/view",
    );
    expect(again.ok).toBe(true);
    expect((await getStaffDemoBoard()).total).toBe(1);
    expect((await getParticipantDemo("mate@byteforge.test")).demo?.driveUrl).toContain("xyz999");

    const cleared = await clearDemoLink("mate@byteforge.test");
    expect(cleared.ok).toBe(true);
    expect((await getStaffDemoBoard()).total).toBe(0);
  });

  it("blocks in-review teams and non-Drive URLs", async () => {
    const { submitDemoLink } = await import("@/lib/hacktivate-docs-service");

    seedTeam({
      code: "REVIEW01",
      name: "Still Waiting",
      leadEmail: "lead@review.test",
      status: "pending",
    });

    const review = await submitDemoLink(
      "lead@review.test",
      "https://drive.google.com/file/d/abc/view",
    );
    expect(review).toMatchObject({ ok: false, code: "not_confirmed", status: 403 });

    seedTeam({
      code: "OKTEAM01",
      name: "Ok Team",
      leadEmail: "lead@ok.test",
    });
    const bad = await submitDemoLink("lead@ok.test", "https://youtube.com/watch?v=1");
    expect(bad).toMatchObject({ ok: false, code: "bad_link", status: 400 });
  });
});

describe("hacktivate demo API routes", () => {
  beforeEach(() => {
    store.clear();
    session.email = null;
    session.name = null;
    session.role = { kind: "none", eventIds: [] };
  });

  it("participant POST stores a Drive link and staff GET lists it for organiser + coordinator", async () => {
    seedTeam({
      code: "APITEAM01",
      name: "Api Team",
      leadEmail: "voxmastery@gmail.com",
      leadName: "Ganesh",
    });

    session.email = "voxmastery@gmail.com";
    session.name = "Ganesh";
    session.role = { kind: "organiser", eventIds: [] };

    const { POST } = await import("@/app/api/hacktivate/docs/route");
    const upRes = await POST(
      new Request("http://local/api/hacktivate/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: "https://drive.google.com/file/d/board/view" }),
      }),
    );
    expect(upRes.status).toBe(200);
    const upBody = await upRes.json();
    expect(upBody.ok).toBe(true);
    expect(upBody.demo.driveUrl).toContain("drive.google.com");

    const { GET: staffGet } = await import("@/app/api/dashboard/hacktivate/docs/route");
    const list = await staffGet();
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.total).toBe(1);
    expect(listBody.demos[0].teamCode).toBe("APITEAM01");

    session.email = "shravanth.polisetty@gmail.com";
    session.role = { kind: "coordinator", eventIds: ["hacktivate"] };
    const coordList = await staffGet();
    expect(coordList.status).toBe(200);
    expect((await coordList.json()).total).toBe(1);

    session.role = { kind: "coordinator", eventIds: ["pitch-pulse"] };
    const denied = await staffGet();
    expect(denied.status).toBe(403);
  });

  it("rejects unsigned participants", async () => {
    const { GET } = await import("@/app/api/hacktivate/docs/route");
    session.email = null;
    const signedOut = await GET();
    expect(signedOut.status).toBe(401);
  });
});
