import { describe, it, expect } from "vitest";
import type { Application } from "@/lib/applications";
import { admissionBlock, applicationKey, classifyStoredTicket, decideStamp, decideUndo, UNDO_WINDOW_MS } from "@/lib/checkin";
import { emailScopedKey } from "@/lib/blob-store";

const row = (extra: Partial<Application> = {}): Application => ({
  ticketId: "PRV-AAAA1111",
  eventId: "robo-climb",
  eventName: "Robo Climb",
  status: "confirmed",
  payment: "paid",
  fee: "Rs. 200/-",
  name: "Asha",
  email: "asha@example.com",
  phone: "9876543210",
  college: "RUAS",
  teamName: null,
  members: null,
  appliedAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

describe("admission", () => {
  it("sends in-review and unpaid to the help desk, and blocks cancelled", () => {
    expect(admissionBlock("confirmed").admit).toBe(true);
    const review = admissionBlock("pending");
    expect(review.admit).toBe(false);
    if (!review.admit) expect(review.tone).toBe("warn");
    const unpaid = admissionBlock("pending", "awaiting");
    expect(unpaid.admit).toBe(false);
    if (!unpaid.admit) expect(unpaid.code).toBe("unpaid");
    const cancelled = admissionBlock("cancelled");
    expect(cancelled.admit).toBe(false);
    if (!cancelled.admit) expect(cancelled.tone).toBe("err");
  });

  it("keeps the first stamp when a second scanner decides", () => {
    const first = decideStamp(row(), "a@x", "2026-10-14T04:00:00.000Z");
    expect(first.write).toBe(true);
    if (!first.write) return;
    const second = decideStamp(first.next, "b@x", "2026-10-14T04:00:01.000Z");
    expect(second.write).toBe(false);
    if (second.write || second.reason !== "already") return;
    expect(second.at).toBe("2026-10-14T04:00:00.000Z");
    expect(second.by).toBe("a@x");
  });

  it("uses the same storage key as the application path", () => {
    expect(applicationKey("robo-climb", "Asha@Example.com")).toBe(emailScopedKey("robo-climb", "Asha@Example.com"));
  });

  it("flags a ticket whose stored path is not the email the QR encodes", () => {
    const key = applicationKey("robo-climb", "asha.rao@example.com");
    const verdict = classifyStoredTicket({
      path: `app/robo-climb/${applicationKey("robo-climb", "asha@example.com")}.json`,
      ticketId: "PRV-1",
      eventId: "robo-climb",
      email: "asha.rao@example.com",
      status: "confirmed",
      ticketCopies: 1,
      knownPaths: new Set([`app/robo-climb/${key}.json`]),
    });
    expect(verdict.reason).toBe("email_mismatch");
  });

  it("allows undo at 30 seconds and refuses a second later", () => {
    const stamped = row({ checkedInAt: "2026-10-14T04:00:00.000Z", checkedInBy: "a@x" });
    const edge = decideUndo(stamped, Date.parse(stamped.checkedInAt!) + UNDO_WINDOW_MS);
    expect(edge.write).toBe(true);
    const late = decideUndo(stamped, Date.parse(stamped.checkedInAt!) + UNDO_WINDOW_MS + 1);
    expect(late.write).toBe(false);
  });
});
