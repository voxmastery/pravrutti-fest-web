import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketValidityNote } from "@/components/ticket-validity-note";
import {
  confirmationHtml,
  confirmationSubject,
  confirmationText,
  ticketValidityLine,
} from "@/lib/ticket-copy";

const ZERO = {
  name: "Ruchika S",
  eventName: "ZERO HOUR",
  ticketId: "PRV-13025CCFFCFBC1D2",
  fee: "Rs. 200/-",
  teamName: "Yukti",
  teamCode: "Z8HZXLGADC93",
  paymentRef: "WSLFZCNZBLAFNA9",
};

const ESCAPE = {
  ...ZERO,
  eventName: "AI ESCAPE ROOM",
  teamCode: "Z5JZR74FW8N3",
  ticketId: "PRV-OTHER",
};

describe("ticket validity copy", () => {
  it("names the registration's own event", () => {
    expect(ticketValidityLine("ZERO HOUR")).toBe(
      "This ticket is only valid for ZERO HOUR. Registered for another event too? Each event has its own ticket.",
    );
    expect(ticketValidityLine(ESCAPE.eventName)).not.toContain("ZERO HOUR");
  });

  it("puts the event and the team code in the subject", () => {
    expect(confirmationSubject(ZERO)).toBe("Your PRAVRUTTI ticket: ZERO HOUR · Z8HZXLGADC93");
    expect(confirmationSubject({ eventName: "The Logic Circuit", teamCode: null })).toBe(
      "Your PRAVRUTTI ticket: The Logic Circuit",
    );
    expect(confirmationSubject({ eventName: "RC-X", teamCode: "  " })).toBe("Your PRAVRUTTI ticket: RC-X");
  });

  it("uses that row's event in the email, not another event the same person holds", () => {
    const url = "https://pravrutti.tech/ticket";
    const html = confirmationHtml(ZERO, url);
    const text = confirmationText(ZERO, url);
    const line = ticketValidityLine("ZERO HOUR");

    expect(html).toContain(line);
    expect(text).toContain(line);
    expect(html).toContain("Team code");
    expect(html).toContain("Z8HZXLGADC93");
    expect(text).toContain("Team code: Z8HZXLGADC93");
    expect(html).not.toContain("AI ESCAPE ROOM");
    expect(text).not.toContain("AI ESCAPE ROOM");

    const other = confirmationHtml(ESCAPE, url);
    expect(other).toContain(ticketValidityLine("AI ESCAPE ROOM"));
    expect(other).not.toContain("only valid for ZERO HOUR");
  });

  it("renders the same sentence on the ticket note, with that event's name", () => {
    const html = renderToStaticMarkup(createElement(TicketValidityNote, { eventName: "ZERO HOUR" }));
    expect(html).toContain("This ticket is only valid for");
    expect(html).toContain("ZERO HOUR");
    expect(html).toContain("Registered for another event too? Each event has its own ticket.");
    expect(html).not.toContain("AI ESCAPE ROOM");
  });
});
