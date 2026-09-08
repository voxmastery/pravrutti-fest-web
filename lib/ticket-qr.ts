import QRCode from "qrcode";
import { PALETTE } from "@/lib/palette";

/**
 * The one place a ticket QR's contents are defined.
 *
 * `lib/checkin.ts` parses this exact shape, so the scanner and every producer
 * of a QR — the ticket page and the confirmation email — have to agree on it.
 * Building it here means they cannot drift apart.
 */
export function ticketPayload(a: { ticketId: string; eventId: string; email: string }) {
  return `${a.ticketId}|${a.eventId}|${a.email.toLowerCase()}`;
}

const RENDER = {
  margin: 1,
  width: 320,
  color: { dark: PALETTE.midnightNavy, light: PALETTE.pearlWhite },
} as const;

export function ticketQrDataUrl(a: { ticketId: string; eventId: string; email: string }) {
  return QRCode.toDataURL(ticketPayload(a), RENDER);
}

/** Base64 PNG for mail attachments, which take bytes rather than a data URL. */
export async function ticketQrBase64(a: { ticketId: string; eventId: string; email: string }) {
  const buffer = await QRCode.toBuffer(ticketPayload(a), { ...RENDER, type: "png" });
  return buffer.toString("base64");
}
