import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 12 Oct 2026: the organisers closed every event but DENT - INNOVATE and
 * ELECTROXCAPE, review included. In review on a closed event, on a team
 * nobody on which is confirmed, is not accepted: counted nowhere, and shown
 * to the student as declined ("Not confirmed"). A confirmed team stays whole.
 */

vi.mock("server-only", () => ({}));
const store = new Map<string, any>();
vi.mock("@/lib/blob-store", () => ({
  listAll: async (prefix: string) =>
    [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ url: "mem:" + k, pathname: k })),
  readPrivate: async (url: string) => store.get(url.slice(4)) ?? null,
}));

import { closedOutRows, countRegistrations, reviewClosed } from "@/lib/registration-counts";
import { isClosedOut } from "@/lib/review-closed";

const row = (over: Record<string, unknown> = {}) => ({
  eventId: "glide-x", name: "A", email: "a@x.com", phone: "9000000000",
  college: "RUAS", status: "pending", payment: "paid", paymentRef: "J5N3Z8Y0MUQG1UY",
  fee: "Rs. 200/-", teamCode: null, ...over,
}) as any;

beforeEach(() => store.clear());

describe("which events' review has closed", () => {
  it("closes review on an event closed by hand or by its own date", () => {
    expect(reviewClosed("glide-x")).toBe(true);
    expect(reviewClosed("chaos")).toBe(true);
    expect(reviewClosed("hacktivate", Date.parse("2026-10-12T12:00:00.000Z"))).toBe(true);
  });

  it("keeps it open on DENT - INNOVATE, ELECTROXCAPE and Discoverize", () => {
    expect(reviewClosed("dent-innovate")).toBe(false);
    expect(reviewClosed("electroxcape")).toBe(false);
    expect(reviewClosed("discoverize-research-paper-presentation")).toBe(false);
  });

  it("knows nothing of an event that does not exist", () => {
    expect(reviewClosed("no-such-event")).toBe(false);
  });
});

describe("who is not accepted", () => {
  it("closes out an in-review solo entry or team on a closed event", () => {
    const solo = row({ email: "s@x.com" });
    const lead = row({ email: "l@x.com", teamCode: "TEAMAAAAAAAA" });
    const mate = row({ email: "m@x.com", teamCode: "TEAMAAAAAAAA", payment: "not_required", fee: "Covered by team lead" });
    const out = closedOutRows([solo, lead, mate]);
    expect([...out]).toEqual([solo, lead, mate]);
    expect(countRegistrations([solo, lead, mate])).toMatchObject({ people: 0, teams: 0, pendingPeople: 0 });
  });

  it("keeps a confirmed team whole, its pending teammate included", () => {
    const lead = row({ email: "l@x.com", teamCode: "TEAMAAAAAAAA", status: "confirmed" });
    const mate = row({ email: "m@x.com", teamCode: "TEAMAAAAAAAA", payment: "not_required", fee: "Covered by team lead" });
    expect(closedOutRows([lead, mate]).size).toBe(0);
    expect(countRegistrations([lead, mate])).toMatchObject({ people: 2, teams: 1 });
  });

  it("leaves in review alone where review is still open", () => {
    const r = row({ eventId: "electroxcape" });
    expect(closedOutRows([r]).size).toBe(0);
    expect(countRegistrations([r])).toMatchObject({ pendingPeople: 1, pendingTeams: 1 });
  });

  it("does not touch confirmed, cancelled or declined rows", () => {
    for (const status of ["confirmed", "cancelled", "declined"])
      expect(closedOutRows([row({ status })]).size).toBe(0);
  });
});

describe("one student's ticket", () => {
  it("reads a pending solo entry on a closed event as closed out", async () => {
    expect(await isClosedOut(row())).toBe(true);
  });

  it("checks the team: a confirmed teammate keeps them in", async () => {
    const mine = row({ email: "m@x.com", teamCode: "TEAMAAAAAAAA" });
    store.set("app/glide-x/l.json", row({ email: "l@x.com", teamCode: "TEAMAAAAAAAA", status: "confirmed" }));
    store.set("app/glide-x/m.json", mine);
    expect(await isClosedOut(mine)).toBe(false);
  });

  it("closes out a team nobody on which is confirmed", async () => {
    const mine = row({ email: "m@x.com", teamCode: "TEAMAAAAAAAA" });
    store.set("app/glide-x/l.json", row({ email: "l@x.com", teamCode: "TEAMAAAAAAAA" }));
    store.set("app/glide-x/m.json", mine);
    expect(await isClosedOut(mine)).toBe(true);
  });

  it("leaves a pending ticket on DENT - INNOVATE in review", async () => {
    expect(await isClosedOut(row({ eventId: "dent-innovate" }))).toBe(false);
  });
});
