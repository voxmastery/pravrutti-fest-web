import { describe, it, expect } from "vitest";
import { newTicketId, TICKET_ID_PATTERN } from "@/lib/ticket-id";
import { ticketPayload } from "@/lib/ticket-qr";
import { parseTicketPayload } from "@/lib/checkin";
import { EVENT_PAGE_STATUS, isLiveApplication } from "@/lib/applications";

describe("newTicketId", () => {
  it("is PRV- plus 16 uppercase hex chars", () => {
    expect(newTicketId()).toMatch(TICKET_ID_PATTERN);
  });

  it("does not collide across many draws", () => {
    const ids = Array.from({ length: 500 }, () => newTicketId());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ticket QR payload", () => {
  it("is ticketId|eventId|email and round-trips through the scanner parser", () => {
    const a = { ticketId: "PRV-DEADBEEFCAFEBABE", eventId: "electroxcape", email: "Asha@Example.com" };
    const raw = ticketPayload(a);
    expect(raw).toBe("PRV-DEADBEEFCAFEBABE|electroxcape|asha@example.com");
    expect(parseTicketPayload(raw)).toEqual({
      ticketId: a.ticketId,
      eventId: a.eventId,
      email: "asha@example.com",
    });
  });

  it("still parses the shorter ids already in production", () => {
    expect(parseTicketPayload("PRV-AB12CD34|robo-climb|a@b.com")?.ticketId).toBe("PRV-AB12CD34");
  });
});

describe("event-page status copy", () => {
  it("says You're going only once a ticket is confirmed", () => {
    expect(EVENT_PAGE_STATUS.confirmed).toBe("You\u2019re going");
    expect(EVENT_PAGE_STATUS.pending).toMatch(/pending/i);
    expect(EVENT_PAGE_STATUS.pending).not.toMatch(/going/i);
  });

  it("treats pending and confirmed as a live application, not declined", () => {
    expect(isLiveApplication("pending")).toBe(true);
    expect(isLiveApplication("confirmed")).toBe(true);
    expect(isLiveApplication("declined")).toBe(false);
    expect(isLiveApplication(null)).toBe(false);
  });
});
