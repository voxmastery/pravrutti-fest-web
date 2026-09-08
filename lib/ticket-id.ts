import { randomBytes } from "crypto";

/**
 * One application, one ticket id.
 *
 * 8 random bytes → 16 hex chars → 64 bits. Birthday collision at fest scale
 * is not a real risk (a 50% chance would need billions of tickets). The
 * previous 4-byte id was 32 bits: unique enough in practice, but two people
 * *could* land on the same `PRV-xxxxxxxx`, and nothing in storage would catch
 * it — applications are keyed by event+email, not by this id.
 *
 * The QR still carries this value (`ticketId|eventId|email`), and check-in
 * requires it to match the stored record, so a unique id is what stops a
 * rebuilt QR for someone else's address from admitting them.
 */
export function newTicketId() {
  return `PRV-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export const TICKET_ID_PATTERN = /^PRV-[0-9A-F]{16}$/;
