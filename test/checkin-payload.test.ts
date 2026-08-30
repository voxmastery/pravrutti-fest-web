import { describe, it, expect } from "vitest";
import type { Application } from "@/lib/applications";
import { parseTicketPayload } from "@/lib/checkin";

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

describe("parseTicketPayload", () => {
  it("parses a well-formed payload", () => {
    expect(parseTicketPayload("PRV-AB12CD34|robo-climb|Asha@Example.com")).toEqual({
      ticketId: "PRV-AB12CD34",
      eventId: "robo-climb",
      email: "asha@example.com",
    });
  });

  it("trims surrounding whitespace from a scan", () => {
    expect(parseTicketPayload("  PRV-AB12CD34|robo-climb|a@b.com  ")?.ticketId)
      .toBe("PRV-AB12CD34");
  });

  it("rejects the wrong number of parts", () => {
    expect(parseTicketPayload("PRV-AB12CD34|robo-climb")).toBeNull();
    expect(parseTicketPayload("a|b|c|d")).toBeNull();
  });

  it("rejects empty parts", () => {
    expect(parseTicketPayload("|robo-climb|a@b.com")).toBeNull();
    expect(parseTicketPayload("PRV-1|robo-climb|")).toBeNull();
  });

  it("rejects a non-Pravrutti QR", () => {
    expect(parseTicketPayload("https://example.com")).toBeNull();
    expect(parseTicketPayload("")).toBeNull();
  });
});
