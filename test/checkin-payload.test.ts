import { describe, it, expect } from "vitest";
import type { Application } from "@/lib/applications";

describe("Application check-in fields", () => {
  it("accepts a record with no check-in fields (existing production data)", () => {
    const a: Application = {
      ticketId: "PRV-AAAA1111",
      eventId: "robo-climb",
      eventName: "Robo Climb",
      status: "confirmed",
      payment: "not_required",
      fee: "Free",
      name: "Asha",
      email: "asha@example.com",
      phone: "9876543210",
      college: "RUAS",
      teamName: null,
      members: null,
      appliedAt: "2026-09-01T10:00:00.000Z",
    };
    expect(a.checkedInAt).toBeUndefined();
  });

  it("accepts a checked-in record", () => {
    const a: Partial<Application> = {
      checkedInAt: "2026-10-15T04:42:00.000Z",
      checkedInBy: "boss@pravrutti.test",
    };
    expect(a.checkedInBy).toBe("boss@pravrutti.test");
  });
});
