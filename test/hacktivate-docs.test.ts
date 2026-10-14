import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOCS_COPY,
  HACKTIVATE_DOC_MAX_BYTES,
  HACKTIVATE_DOC_MAX_PER_TEAM,
  formatDocSize,
  hacktivateDocPath,
  sanitizePdfFileName,
} from "@/lib/hacktivate-docs";
import { isPdfMagic, validatePdfUpload, contentFingerprint, newDocId } from "@/lib/hacktivate-docs-node";
import { canManageTrackPick, HACKTIVATE_EVENT_ID } from "@/lib/track-pick";

const EVENT = HACKTIVATE_EVENT_ID;

describe("hacktivate docs helpers", () => {
  it("sanitises PDF names and rejects path traversal junk", () => {
    expect(sanitizePdfFileName("My Schematic.PDF")).toBe("My Schematic.pdf");
    expect(sanitizePdfFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizePdfFileName("board photo (1).pdf")).toBe("board photo (1).pdf");
    expect(sanitizePdfFileName("")).toBeNull();
    expect(sanitizePdfFileName("...")).toBeNull();
    expect(sanitizePdfFileName(".pdf")).toBeNull();
  });

  it("accepts only %PDF- magic and enforces size", () => {
    const ok = Buffer.from("%PDF-1.4\n% schematic\n");
    expect(isPdfMagic(ok)).toBe(true);
    expect(isPdfMagic(Buffer.from("not a pdf"))).toBe(false);

    const good = validatePdfUpload({ fileName: "schematic.pdf", bytes: ok });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.fileName).toBe("schematic.pdf");
      expect(good.contentBase64).toBe(ok.toString("base64"));
      expect(contentFingerprint(good.contentBase64)).toMatch(/^[a-f0-9]{16}$/);
    }

    const empty = validatePdfUpload({ fileName: "a.pdf", bytes: Buffer.alloc(0) });
    expect(empty).toMatchObject({ ok: false, code: "empty", message: DOCS_COPY.empty });

    const huge = validatePdfUpload({
      fileName: "a.pdf",
      bytes: Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.alloc(HACKTIVATE_DOC_MAX_BYTES)]),
    });
    expect(huge).toMatchObject({ ok: false, code: "too_large" });

    const png = validatePdfUpload({
      fileName: "shot.png",
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    });
    expect(png).toMatchObject({ ok: false, code: "bad_type" });
  });

  it("formats sizes and builds storage paths", () => {
    expect(formatDocSize(500)).toBe("500 B");
    expect(formatDocSize(2048)).toBe("2.0 KB");
    expect(hacktivateDocPath("byteforge01", "abcd")).toBe("hacktivate-doc/BYTEFORGE01/abcd.json");
    expect(newDocId()).toMatch(/^[a-f0-9]{16}$/);
    expect(HACKTIVATE_DOC_MAX_PER_TEAM).toBe(5);
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
  putJson: async (p: string, data: unknown, overwrite: boolean) => {
    if (!overwrite && store.has(p)) throw new Error("exists");
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

const tinyPdf = () => Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("hacktivate docs service", () => {
  beforeEach(() => {
    store.clear();
    session.email = null;
    session.name = null;
    session.role = { kind: "none", eventIds: [] };
  });

  it("lets a confirmed teammate upload, lists for staff, and serves download bytes", async () => {
    const {
      uploadParticipantPdf,
      getParticipantDocs,
      getStaffDocsBoard,
      getDocForDownload,
      deleteParticipantPdf,
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

    const denied = await getParticipantDocs("pending@x.test");
    expect(denied.canUpload).toBe(false);

    const before = await getParticipantDocs("mate@byteforge.test");
    expect(before.canUpload).toBe(true);
    expect(before.docs).toHaveLength(0);

    const up = await uploadParticipantPdf("mate@byteforge.test", {
      fileName: "schematic-v1.pdf",
      bytes: tinyPdf(),
    });
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.doc.teamCode).toBe("BYTEFORGE01");
    expect(up.doc.fileName).toBe("schematic-v1.pdf");
    expect(up.state.docs).toHaveLength(1);

    const board = await getStaffDocsBoard();
    expect(board.total).toBe(1);
    expect(board.docs[0]?.teamName).toBe("ByteForge");

    const dl = await getDocForDownload(up.doc.id, "BYTEFORGE01");
    expect(dl.ok).toBe(true);
    if (dl.ok) {
      expect(dl.bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(dl.record.uploadedByEmail).toBe("mate@byteforge.test");
    }

    const gone = await deleteParticipantPdf("mate@byteforge.test", up.doc.id);
    expect(gone.ok).toBe(true);
    expect((await getStaffDocsBoard()).total).toBe(0);
  });

  it("blocks in-review teams, non-PDFs, and the per-team cap", async () => {
    const { uploadParticipantPdf } = await import("@/lib/hacktivate-docs-service");

    seedTeam({
      code: "REVIEW01",
      name: "Still Waiting",
      leadEmail: "lead@review.test",
      status: "pending",
    });

    const review = await uploadParticipantPdf("lead@review.test", {
      fileName: "early.pdf",
      bytes: tinyPdf(),
    });
    expect(review).toMatchObject({ ok: false, code: "not_confirmed", status: 403 });

    seedTeam({
      code: "FULLTEAM1",
      name: "Full Stack",
      leadEmail: "lead@full.test",
      leadName: "Lead",
    });

    for (let i = 0; i < HACKTIVATE_DOC_MAX_PER_TEAM; i++) {
      const r = await uploadParticipantPdf("lead@full.test", {
        fileName: `part-${i}.pdf`,
        bytes: tinyPdf(),
      });
      expect(r.ok).toBe(true);
    }
    const over = await uploadParticipantPdf("lead@full.test", {
      fileName: "one-more.pdf",
      bytes: tinyPdf(),
    });
    expect(over).toMatchObject({ ok: false, code: "team_full", status: 409 });

    const bad = await uploadParticipantPdf("lead@full.test", {
      fileName: "photo.jpg",
      bytes: Buffer.from("JFIF"),
    });
    expect(bad).toMatchObject({ ok: false, code: "bad_type" });
  });
});

describe("hacktivate docs API routes", () => {
  beforeEach(() => {
    store.clear();
    session.email = null;
    session.name = null;
    session.role = { kind: "none", eventIds: [] };
  });

  it("participant POST stores a PDF and staff GET downloads it for organiser + coordinator", async () => {
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
    const form = new FormData();
    form.append(
      "file",
      new File([tinyPdf()], "board.pdf", { type: "application/pdf" }),
    );
    const upRes = await POST(new Request("http://local/api/hacktivate/docs", { method: "POST", body: form }));
    expect(upRes.status).toBe(200);
    const upBody = await upRes.json();
    expect(upBody.ok).toBe(true);
    expect(upBody.docs).toHaveLength(1);
    const id = upBody.doc.id as string;

    const { GET: staffGet } = await import("@/app/api/dashboard/hacktivate/docs/route");
    const list = await staffGet(new Request("http://local/api/dashboard/hacktivate/docs"));
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.total).toBe(1);

    const dl = await staffGet(
      new Request(
        `http://local/api/dashboard/hacktivate/docs?download=${id}&team=APITEAM01`,
      ),
    );
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("application/pdf");
    expect(dl.headers.get("content-disposition")).toMatch(/board\.pdf/);
    const bytes = Buffer.from(await dl.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    session.email = "shravanth.polisetty@gmail.com";
    session.role = { kind: "coordinator", eventIds: ["hacktivate"] };
    const coordList = await staffGet(new Request("http://local/api/dashboard/hacktivate/docs"));
    expect(coordList.status).toBe(200);
    expect((await coordList.json()).total).toBe(1);

    session.role = { kind: "coordinator", eventIds: ["pitch-pulse"] };
    const denied = await staffGet(new Request("http://local/api/dashboard/hacktivate/docs"));
    expect(denied.status).toBe(403);
  });

  it("rejects unsigned participants and foreign event coordinators on upload GET", async () => {
    const { GET } = await import("@/app/api/hacktivate/docs/route");
    session.email = null;
    const signedOut = await GET();
    expect(signedOut.status).toBe(401);
  });
});
