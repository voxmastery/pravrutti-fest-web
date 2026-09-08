export type TicketPayload = {
  ticketId: string;
  eventId: string;
  email: string;
};

/**
 * Parses the string encoded into a ticket QR by `ticketPayload` in
 * lib/ticket-qr.ts (`${ticketId}|${eventId}|${email}`). Every producer — the
 * ticket page, the confirmation email, /api/status — has to go through that
 * helper so this parser cannot drift from what gets printed.
 *
 * Returns null for anything else, so a stray QR from another app is a clean
 * rejection rather than a lookup against garbage.
 */
export function parseTicketPayload(raw: string): TicketPayload | null {
  const parts = String(raw ?? "").trim().split("|");
  if (parts.length !== 3) return null;

  const [ticketId, eventId, email] = parts.map((p) => p.trim());
  if (!ticketId || !eventId || !email) return null;

  return { ticketId, eventId, email: email.toLowerCase() };
}
