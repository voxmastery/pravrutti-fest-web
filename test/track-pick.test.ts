import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  COPY,
  HACKTIVATE_EVENT_ID,
  TRACKS,
  TRACK_CAP,
  TRACK_PICK_OPEN_UTC,
  canManageTrackPick,
  componentsReadyLine,
  gate,
  trackById,
  trackCardLabel,
  trackPickOpensAt,
  type ViewerFacts,
} from "@/lib/track-pick";
import {
  claimPick,
  createMemoryTrackPickDb,
  movePick,
  setPickingPaused,
  undoPick,
  type TrackPickDb,
} from "@/lib/track-pick-engine";
import { TRACK_PICKS_TABLE_SQL, TRACK_PICK_LOCK_SQL } from "@/lib/track-pick-db";
import { trackPickCsv, trackPickExportRows } from "@/lib/track-pick-export";

const OPEN = Date.parse(TRACK_PICK_OPEN_UTC);
const BEFORE = OPEN - 60_000;
const AFTER = OPEN + 5_000;
const EVENT = HACKTIVATE_EVENT_ID;

function facts(over: Partial<ViewerFacts> & { team?: ViewerFacts["team"] } = {}): ViewerFacts {
  return {
    email: "lead@byteforge.test",
    isLead: true,
    viewerLive: true,
    team: {
      code: "BYTEFORGE01",
      name: "ByteForge",
      leadEmail: "lead@byteforge.test",
      leadName: "Arjun K",
      status: "confirmed",
    },
    ...over,
  };
}

const baseClaim = {
  eventId: EVENT,
  opensAt: OPEN,
  pickedBy: "lead@byteforge.test",
  teamName: "ByteForge",
  leadName: "Arjun K",
  leadEmail: "lead@byteforge.test",
  leadPhone: "9876543210",
};

describe("track copy", () => {
  it("keeps Track 1's title in config and describes an optional kit", () => {
    const track = trackById("01")!;
    expect(track.title.length).toBeGreaterThan(0);
    expect(track.theme).toMatch(/Road & Transport/i);
    expect(track.theme).toMatch(/predictive road safety/i);
    expect(track.summary).toMatch(/any components allowed/i);
    expect(track.summary).toMatch(/kit available on site/i);
    expect(track.problemNote).toBe("Problem statement drops soon");
    const label = trackCardLabel(track).toLowerCase();
    expect(label).toContain(track.title.toLowerCase());
    expect(label).toContain("track 01");
    expect(label).not.toMatch(/kit-only|nothing else/);
    expect(track.tags.join(" ").toLowerCase()).not.toMatch(/kit-only/);
  });

  it("tells every track to get components ready", () => {
    for (const track of TRACKS) {
      expect(componentsReadyLine(track.id)).toBe(
        `Track ${Number(track.id)}/3: get your components ready before the event.`,
      );
    }
  });

  it("does not mention WhatsApp anywhere in the track-pick feature", () => {
    const files = [
      "lib/track-pick.ts",
      "lib/track-pick-engine.ts",
      "lib/track-pick-service.ts",
      "components/hacktivate/track-pick-screen.tsx",
      "components/hacktivate/track-control-screen.tsx",
      "app/api/hacktivate/track-pick/route.ts",
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8").toLowerCase(), file).not.toContain("whatsapp");
    }
  });

  it("opens at 9:30 AM IST on 11 Oct 2026 unless a valid override is set", () => {
    expect(trackPickOpensAt({})).toBe(OPEN);
    expect(trackPickOpensAt({ TRACK_PICK_OPENS_AT: "not-a-date" })).toBe(OPEN);
    expect(trackPickOpensAt({ TRACK_PICK_OPENS_AT: "2026-10-11T09:30:00+05:30" })).toBe(OPEN);
    expect(trackPickOpensAt({ TRACK_PICK_OPENS_AT: "2020-01-01T00:00:00.000Z" })).toBe(Date.parse("2020-01-01T00:00:00.000Z"));
  });

  it("puts the one-pick and one-seat constraints in the database schema", () => {
    expect(TRACK_PICKS_TABLE_SQL).toMatch(/PRIMARY KEY \(event_id, team_code\)/);
    expect(TRACK_PICKS_TABLE_SQL).toMatch(/UNIQUE KEY track_seat/);
    expect(TRACK_PICK_LOCK_SQL).toMatch(/FOR UPDATE/);
    const migration = readFileSync("scripts/migrate-blob-to-mysql.mjs", "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS track_picks");
    expect(migration).toContain("UNIQUE KEY track_seat");
    expect(migration).toContain("PRIMARY KEY (event_id, team_code)");
  });
});

describe("eligibility", () => {
  const open = { now: AFTER, opensAt: OPEN, paused: false, picked: false };

  it("refuses a Google account with no Hacktivate team", () => {
    const d = gate({ facts: facts({ team: null, viewerLive: false, isLead: false }), ...open });
    expect(d.screen).toBe("no_team");
    expect(d.canPick).toBe(false);
  });

  it("locks in-review teams, including a member of one, out of a seat", () => {
    const team = { ...facts().team!, status: "in_review" as const };
    expect(gate({ facts: facts({ team, isLead: false }), ...open }).screen).toBe("ineligible");
    expect(gate({ facts: facts({ team, isLead: true }), ...open }).screen).toBe("ineligible");
    expect(gate({ facts: facts({ team: { ...team, status: "closed" } }), ...open }).screen).toBe("ineligible");
  });

  it("lets a confirmed member watch and blocks them from picking", () => {
    const d = gate({ facts: facts({ isLead: false, email: "mate@byteforge.test" }), ...open });
    expect(d.screen).toBe("member");
    expect(d.canPick).toBe(false);
    expect(d.message).toBe(COPY.notLead);
  });

  it("shows a countdown to a confirmed lead before 9:30 IST and refuses the pick", () => {
    const d = gate({ facts: facts(), now: BEFORE, opensAt: OPEN, paused: false, picked: false });
    expect(d.screen).toBe("countdown");
    expect(d.canPick).toBe(false);
  });

  it("opens the picker for the confirmed lead at 9:30 and after", () => {
    expect(gate({ facts: facts(), now: OPEN, opensAt: OPEN, paused: false, picked: false }).canPick).toBe(true);
    expect(gate({ facts: facts(), ...open }).screen).toBe("picker");
  });

  it("shows the locked card once the team has picked, lead or member", () => {
    expect(gate({ facts: facts(), ...open, picked: true }).screen).toBe("locked");
    expect(gate({ facts: facts({ isLead: false }), ...open, picked: true }).screen).toBe("locked");
    expect(gate({ facts: facts(), ...open, picked: true }).canPick).toBe(false);
  });

  it("pauses picking for a lead who has not locked yet", () => {
    const d = gate({ facts: facts(), ...open, paused: true });
    expect(d.screen).toBe("paused");
    expect(d.canPick).toBe(false);
  });

  it("checks confirmation before the lead, so an in-review lead is not a member view", () => {
    const d = gate({
      facts: facts({ isLead: false, team: { ...facts().team!, status: "in_review" } }),
      ...open,
    });
    expect(d.screen).toBe("ineligible");
  });
});

describe("role access", () => {
  it("allows organisers and Hacktivate coordinators, and nobody else", () => {
    expect(canManageTrackPick({ kind: "organiser" })).toBe(true);
    expect(canManageTrackPick({ kind: "coordinator", eventIds: ["hacktivate", "chaos"] })).toBe(true);
    expect(canManageTrackPick({ kind: "coordinator", eventIds: ["chaos"] })).toBe(false);
    expect(canManageTrackPick({ kind: "coordinator", eventIds: [] })).toBe(false);
    expect(canManageTrackPick({ kind: "none" })).toBe(false);
  });
});

describe("claim engine", () => {
  let db: TrackPickDb;
  beforeEach(() => {
    db = createMemoryTrackPickDb();
  });

  const claim = (team: string, track: string, now = AFTER) =>
    claimPick(db, { ...baseClaim, now, teamCode: team, trackId: track, teamName: team, leadEmail: `${team}@t.test`, pickedBy: `${team}@t.test` });

  it("rejects a pick before the opening instant and stores nothing", async () => {
    const result = await claim("BYTEFORGE01", "02", BEFORE);
    expect(result).toMatchObject({ ok: false, code: "not_open" });
    const picks = await db.transaction((tx) => tx.listPicks());
    expect(picks).toHaveLength(0);
  });

  it("rejects a pick while paused", async () => {
    await setPickingPaused(db, true, { email: "voxmastery@gmail.com", name: "Ganesh" }, new Date(AFTER).toISOString());
    const result = await claim("BYTEFORGE01", "02");
    expect(result).toMatchObject({ ok: false, code: "paused" });
  });

  it("gives one seat per team and treats a repeat of that track as the same pick", async () => {
    const first = await claim("BYTEFORGE01", "02");
    const again = await claim("BYTEFORGE01", "02");
    const other = await claim("BYTEFORGE01", "03");
    expect(first.ok && again.ok).toBe(true);
    if (first.ok && again.ok) {
      expect(again.idempotent).toBe(true);
      expect(again.pick.seat).toBe(first.pick.seat);
      expect(again.pick.trackId).toBe("02");
    }
    expect(other).toMatchObject({ ok: false, code: "already_picked" });
    const picks = await db.transaction((tx) => tx.listPicks());
    expect(picks).toHaveLength(1);
  });

  it("collapses concurrent double-taps of one team into a single seat", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => claim("BYTEFORGE01", "02")));
    expect(results.every((r) => r.ok)).toBe(true);
    const seats = new Set(results.filter((r) => r.ok).map((r) => r.pick.seat));
    expect(seats.size).toBe(1);
    const picks = await db.transaction((tx) => tx.listPicks());
    expect(picks).toHaveLength(1);
  });

  it("lets exactly 20 of many concurrent requests onto one track", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => claim(`TEAM${String(i).padStart(8, "0")}`, "01")),
    );
    const won = results.filter((r) => r.ok);
    const lost = results.filter((r) => !r.ok);
    expect(won).toHaveLength(TRACK_CAP);
    expect(lost).toHaveLength(10);
    expect(lost.every((r) => !r.ok && r.code === "full")).toBe(true);
    const picks = await db.transaction((tx) => tx.picksForTrack("01"));
    expect(picks).toHaveLength(20);
    expect(new Set(picks.map((p) => p.seat))).toEqual(new Set(Array.from({ length: 20 }, (_, i) => i + 1)));
    expect(new Set(picks.map((p) => p.teamCode)).size).toBe(20);
  });

  it("caps each of the three tracks at 20 under concurrent load", async () => {
    const jobs = [];
    for (const track of ["01", "02", "03"]) {
      for (let i = 0; i < 25; i++) jobs.push(claim(`${track}T${String(i).padStart(8, "0")}`, track));
    }
    await Promise.all(jobs);
    for (const track of ["01", "02", "03"]) {
      const picks = await db.transaction((tx) => tx.picksForTrack(track));
      expect(picks, track).toHaveLength(20);
    }
  });

  it("keeps the first track when two tracks are submitted together for one team", async () => {
    const [a, b] = await Promise.all([claim("BYTEFORGE01", "02"), claim("BYTEFORGE01", "03")]);
    const oks = [a, b].filter((r) => r.ok);
    expect(oks).toHaveLength(1);
    const picks = await db.transaction((tx) => tx.listPicks());
    expect(picks).toHaveLength(1);
  });

  it("logs an undo with the actor and reason, then lets the team pick again", async () => {
    await claim("BYTEFORGE01", "02");
    const missing = await undoPick(db, "BYTEFORGE01", { email: "voxmastery@gmail.com", name: "Ganesh" }, "  ", new Date(AFTER).toISOString(), EVENT);
    expect(missing).toMatchObject({ ok: false, code: "reason" });
    const undone = await undoPick(
      db,
      "byteforge01",
      { email: "shravanth.polisetty@gmail.com", name: "Shravanth" },
      "Team registered for the wrong brief",
      new Date(AFTER).toISOString(),
      EVENT,
    );
    expect(undone.ok).toBe(true);
    const audit = await db.transaction((tx) => tx.listAudit());
    expect(audit[0]).toMatchObject({
      action: "undo",
      actorName: "Shravanth",
      actorEmail: "shravanth.polisetty@gmail.com",
      reason: "Team registered for the wrong brief",
      fromTrack: "02",
    });
    const again = await claim("BYTEFORGE01", "03");
    expect(again.ok).toBe(true);
  });

  it("refuses a move onto a full track and logs a move that fits", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => claim(`FILL${String(i).padStart(8, "0")}`, "01")));
    await claim("BYTEFORGE01", "02");
    const blocked = await movePick(
      db,
      "BYTEFORGE01",
      "01",
      { email: "voxmastery@gmail.com", name: "Ganesh" },
      "They asked to switch",
      new Date(AFTER).toISOString(),
      EVENT,
    );
    expect(blocked).toMatchObject({ ok: false, code: "full" });
    const still = await db.transaction((tx) => tx.readPick("BYTEFORGE01"));
    expect(still?.trackId).toBe("02");

    const moved = await movePick(
      db,
      "BYTEFORGE01",
      "03",
      { email: "voxmastery@gmail.com", name: "Ganesh" },
      "Hardware brief fits them better",
      new Date(AFTER).toISOString(),
      EVENT,
    );
    expect(moved.ok).toBe(true);
    const audit = await db.transaction((tx) => tx.listAudit());
    expect(audit[0]).toMatchObject({
      action: "move",
      actorName: "Ganesh",
      fromTrack: "02",
      toTrack: "03",
      reason: "Hardware brief fits them better",
    });
    const seatTaken = await db.transaction((tx) => tx.picksForTrack("02"));
    expect(seatTaken.some((p) => p.teamCode === "BYTEFORGE01")).toBe(false);
  });
});

/* The service is the door the routes use: eligibility, the clock, and the
   engine together. The blob store is the same shape the rest of the tests use. */
const store = new Map<string, unknown>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (e: string, m: string) => `app/${e}/${m.toLowerCase()}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m.toLowerCase()}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: `mem:${k}` })),
  readPrivate: async (url: string) => store.get(String(url).slice(4)) ?? null,
}));

const session = { email: null as string | null, role: { kind: "none", eventIds: [] as string[] } };

vi.mock("@/lib/identity", () => ({
  resolveEmail: async () => session.email,
  resolveDisplayName: async () => null,
}));

vi.mock("@/lib/roles", () => ({
  resolveRole: async () => session.role,
}));

function seedTeam(opts: {
  code: string;
  name: string;
  leadEmail: string;
  leadName?: string;
  phone?: string;
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
      member: { name: person.name, email: person.email, phone: opts.phone ?? "9876543210", college: "RUAS", joinedAt: "2026-10-01T00:00:00.000Z" },
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
      phone: opts.phone ?? "9876543210",
      college: "RUAS",
      teamName: opts.name,
      teamCode: opts.code,
      members: null,
      appliedAt: "2026-10-01T00:00:00.000Z",
    });
  }
}

describe("claim service", () => {
  let db: TrackPickDb;
  beforeEach(() => {
    store.clear();
    db = createMemoryTrackPickDb();
  });

  const deps = (now: number) => ({ now, opensAt: OPEN, db });

  it("refuses a lead before opening, a member, an in-review team, and a stranger", async () => {
    const { claimTrack, getParticipantState } = await import("@/lib/track-pick-service");
    seedTeam({
      code: "BYTEFORGE01",
      name: "ByteForge",
      leadEmail: "lead@byteforge.test",
      leadName: "Arjun K",
      phone: "9876543210",
      members: [{ email: "mate@byteforge.test", name: "Riya" }],
    });
    seedTeam({
      code: "CIRCUITCREW1",
      name: "CircuitCrew",
      leadEmail: "review@circuit.test",
      status: "pending",
    });

    const early = await claimTrack("lead@byteforge.test", "02", deps(BEFORE));
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe("countdown");

    const member = await claimTrack("mate@byteforge.test", "02", deps(AFTER));
    expect(member.ok).toBe(false);
    if (!member.ok) expect(member.code).toBe("member");

    const review = await getParticipantState("review@circuit.test", deps(AFTER));
    expect(review.screen).toBe("ineligible");
    const reviewPick = await claimTrack("review@circuit.test", "01", deps(AFTER));
    expect(reviewPick.ok).toBe(false);

    const stranger = await getParticipantState("nobody@example.com", deps(AFTER));
    expect(stranger.screen).toBe("no_team");

    const picks = await db.transaction((tx) => tx.listPicks());
    expect(picks).toHaveLength(0);
  });

  it("locks a confirmed lead in, is idempotent, and then refuses a different track", async () => {
    const { claimTrack } = await import("@/lib/track-pick-service");
    seedTeam({
      code: "BYTEFORGE01",
      name: "ByteForge",
      leadEmail: "Lead@ByteForge.test",
      leadName: "Arjun K",
      phone: "9876543210",
    });
    const first = await claimTrack("lead@byteforge.test", "02", deps(AFTER));
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.state.screen).toBe("locked");
      expect(first.state.pick?.seat).toBe(1);
      expect(first.state.pick?.trackId).toBe("02");
    }
    const again = await claimTrack("LEAD@byteforge.test", "02", deps(AFTER + 10));
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.idempotent).toBe(true);
    const switched = await claimTrack("lead@byteforge.test", "03", deps(AFTER + 20));
    expect(switched.ok).toBe(false);
    if (!switched.ok) expect(switched.code).toBe("already_picked");
  });

  it("tells the lead when the track fills between confirm and lock", async () => {
    const { claimTrack } = await import("@/lib/track-pick-service");
    seedTeam({ code: "BYTEFORGE01", name: "ByteForge", leadEmail: "lead@byteforge.test", leadName: "Arjun K" });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        const email = `fill${i}@t.test`;
        seedTeam({ code: `FILL${String(i).padStart(8, "0")}`, name: `Fill ${i}`, leadEmail: email, leadName: `Fill ${i}` });
        return claimTrack(email, "01", deps(AFTER));
      }),
    );
    const late = await claimTrack("lead@byteforge.test", "01", deps(AFTER + 1));
    expect(late.ok).toBe(false);
    if (!late.ok) {
      expect(late.status).toBe(409);
      expect(late.code).toBe("full");
      expect(late.message).toMatch(/Track 01 just filled/);
      expect(late.message).toMatch(/not saved/i);
    }
  });

  it("builds a staff board with phones and an in-review count", async () => {
    const { claimTrack, getStaffBoard } = await import("@/lib/track-pick-service");
    seedTeam({
      code: "BYTEFORGE01",
      name: "ByteForge",
      leadEmail: "lead@byteforge.test",
      leadName: "Arjun K",
      phone: "9876543210",
    });
    seedTeam({
      code: "CIRCUITCREW1",
      name: "CircuitCrew",
      leadEmail: "review@circuit.test",
      leadName: "Neel",
      phone: "9123456780",
      status: "pending",
    });
    await claimTrack("lead@byteforge.test", "02", deps(AFTER));
    const board = await getStaffBoard(deps(AFTER));
    expect(board.pickedTeams).toBe(1);
    expect(board.confirmedTeams).toBe(1);
    expect(board.notPicked).toBe(0);
    expect(board.inReview).toBe(1);
    expect(board.counts.find((c) => c.id === "02")?.picked).toBe(1);
    const row = board.rows.find((r) => r.teamCode === "BYTEFORGE01");
    expect(row).toMatchObject({ leadPhone: "9876543210", leadName: "Arjun K", trackId: "02", status: "confirmed" });
    const csv = trackPickCsv(trackPickExportRows(board.rows));
    expect(csv).toContain("9876543210");
    expect(csv).toContain("ByteForge");
    expect(csv.split("\n")[0]).toContain("Phone");
  });
});

describe("track-pick routes", () => {
  let GET: typeof import("@/app/api/hacktivate/track-pick/route").GET;
  let POST: typeof import("@/app/api/hacktivate/track-pick/route").POST;
  let staffGET: typeof import("@/app/api/dashboard/hacktivate/track-pick/route").GET;
  let staffPOST: typeof import("@/app/api/dashboard/hacktivate/track-pick/route").POST;

  beforeAll(async () => {
    ({ GET, POST } = await import("@/app/api/hacktivate/track-pick/route"));
    ({ GET: staffGET, POST: staffPOST } = await import("@/app/api/dashboard/hacktivate/track-pick/route"));
  });

  beforeEach(async () => {
    store.clear();
    session.email = null;
    session.role = { kind: "none", eventIds: [] };
    const { resetTrackPickDbForTests } = await import("@/lib/track-pick-db");
    resetTrackPickDbForTests();
    process.env.TRACK_PICK_OPENS_AT = "2000-01-01T00:00:00.000Z";
  });

  it("requires a session and rejects an early pick on the server clock", async () => {
    const unsigned = await GET();
    expect(unsigned.status).toBe(401);

    seedTeam({ code: "BYTEFORGE01", name: "ByteForge", leadEmail: "lead@byteforge.test", leadName: "Arjun K" });
    session.email = "lead@byteforge.test";
    process.env.TRACK_PICK_OPENS_AT = "2099-01-01T00:00:00.000Z";
    const early = await POST(new Request("http://t/api/hacktivate/track-pick", {
      method: "POST",
      body: JSON.stringify({ trackId: "02" }),
    }));
    expect(early.status).toBe(403);
    const body = await early.json();
    expect(body.code).toBe("countdown");
    expect(body.ok).toBe(false);
  });

  it("hides Track Control from other roles and allows organiser and Hacktivate coordinator", async () => {
    session.email = "person@example.com";
    expect((await staffGET()).status).toBe(403);

    session.role = { kind: "coordinator", eventIds: ["chaos"] };
    expect((await staffGET()).status).toBe(403);

    session.role = { kind: "coordinator", eventIds: ["hacktivate"] };
    session.email = "shravanth.polisetty@gmail.com";
    const coord = await staffGET();
    expect(coord.status).toBe(200);
    expect((await coord.json()).role).toBe("coordinator");

    session.role = { kind: "organiser", eventIds: [] };
    session.email = "voxmastery@gmail.com";
    const org = await staffGET();
    expect(org.status).toBe(200);
    expect((await org.json()).actorName).toBe("Ganesh");
  });

  it("pauses from Track Control and the server then refuses a lead", async () => {
    seedTeam({ code: "BYTEFORGE01", name: "ByteForge", leadEmail: "lead@byteforge.test", leadName: "Arjun K" });
    session.email = "voxmastery@gmail.com";
    session.role = { kind: "organiser", eventIds: [] };
    const paused = await staffPOST(new Request("http://t/api/dashboard/hacktivate/track-pick", {
      method: "POST",
      body: JSON.stringify({ action: "pause", paused: true }),
    }));
    expect(paused.status).toBe(200);
    expect((await paused.json()).paused).toBe(true);

    session.email = "lead@byteforge.test";
    const pick = await POST(new Request("http://t/api/hacktivate/track-pick", {
      method: "POST",
      body: JSON.stringify({ trackId: "03" }),
    }));
    expect(pick.status).toBe(403);
    expect((await pick.json()).code).toBe("paused");
  });
});
