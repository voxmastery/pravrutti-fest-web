import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";
import { COVERED_BY_LEAD, MAX_TEAM_SIZE, formatFee, feeForApplicant } from "@/lib/applications";
import { maxTeamSizeFor, rosterPeople, toTeamPreview, type Team, type TeamMember } from "@/lib/teams";

const lead: TeamMember = {
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "9876543210",
  college: "Ramaiah Institute of Technology",
  joinedAt: "2026-09-01T00:00:00.000Z",
};

const team = (over: Partial<Team> = {}): Team => ({
  code: "ABCD23EFGH45",
  eventId: "robo-race",
  name: "Bolt",
  bio: "",
  createdByEmail: lead.email,
  members: [lead],
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("maxTeamSizeFor", () => {
  it("uses the event's own teamSize.max, not a global cap", () => {
    const robo = events.find((e) => eventId(e.name) === "robo-race")!;
    const glide = events.find((e) => eventId(e.name) === "glide-x")!;
    expect(maxTeamSizeFor(robo)).toBe(4);
    expect(maxTeamSizeFor(glide)).toBe(2);
    expect(maxTeamSizeFor(glide)).not.toBe(MAX_TEAM_SIZE);
  });
});

describe("toTeamPreview", () => {
  it("is not full after only the lead is on a 4-person event", () => {
    const preview = toTeamPreview(team(), [lead], 4);
    expect(preview.memberCount).toBe(1);
    expect(preview.maxMembers).toBe(4);
    expect(preview.isFull).toBe(false);
  });

  it("is full at the event max, even when that is below 4", () => {
    const two: TeamMember[] = [
      lead,
      { ...lead, email: "ravi@example.com", name: "Ravi" },
    ];
    const preview = toTeamPreview(team({ eventId: "glide-x" }), two, 2);
    expect(preview.isFull).toBe(true);
    expect(preview.maxMembers).toBe(2);
  });

  it("does not attach names or emails on a public preview", () => {
    const preview = toTeamPreview(team(), [lead], 4);
    expect(preview.members).toBeUndefined();
    expect(JSON.stringify(preview)).not.toMatch(/asha@example.com/i);
    expect(JSON.stringify(preview)).not.toMatch(/9876543210/);
  });

  it("lists name and email, never phone, when the roster is requested", () => {
    const two: TeamMember[] = [
      lead,
      { ...lead, email: "Ravi@Example.com", name: "Ravi Kumar", phone: "9876543211" },
    ];
    const preview = toTeamPreview(team(), two, 4, true);
    expect(preview.members).toEqual([
      { name: "Asha Rao", email: "asha@example.com", status: "joined" },
      { name: "Ravi Kumar", email: "ravi@example.com", status: "joined" },
    ]);
    expect(JSON.stringify(preview)).not.toMatch(/987654321/);
    expect(JSON.stringify(preview)).not.toMatch(/college/i);
  });
});

describe("rosterPeople", () => {
  it("drops phone and college and lowercases email", () => {
    expect(rosterPeople([lead])).toEqual([
      { name: "Asha Rao", email: "asha@example.com", status: "joined" },
    ]);
  });
});

describe("feeForApplicant", () => {
  it("charges the lead the team fee once, never per head", () => {
    expect(feeForApplicant({ eventFree: false, eventFee: "Paid", isJoiner: false })).toEqual({
      payment: "awaiting",
      fee: formatFee(1),
    });
  });

  it("does not charge a teammate who joined with a code", () => {
    expect(feeForApplicant({ eventFree: false, eventFee: "Paid", isJoiner: true })).toEqual({
      payment: "not_required",
      fee: COVERED_BY_LEAD,
    });
  });

  it("keeps a free event free for everyone", () => {
    expect(feeForApplicant({ eventFree: true, eventFee: "Free", isJoiner: false }).payment).toBe("not_required");
    expect(feeForApplicant({ eventFree: true, eventFee: "Free", isJoiner: true }).payment).toBe("not_required");
  });
});
