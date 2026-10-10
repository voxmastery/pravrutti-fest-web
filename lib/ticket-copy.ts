import type { Application } from "@/lib/applications";
import { PALETTE } from "@/lib/palette";
import { FEST } from "@/lib/pravrutti-data";

/**
 * Copy shared by the confirmation email and My Tickets.
 *
 * The event name has to come from the registration row. A person can hold
 * two tickets, and the desk scans one QR per event.
 */

const BRAND = {
  ink: PALETTE.midnightNavy,
  panel: PALETTE.cosmicPurple,
  line: PALETTE.royalWine,
  cream: PALETTE.pearlWhite,
  gold: PALETTE.champagneGold,
  pink: PALETTE.cyberPink,
};

export function ticketValidityLine(eventName: string): string {
  return `This ticket is only valid for ${eventName}. Registered for another event too? Each event has its own ticket.`;
}

/** Subject for the confirmation. Event is always named; the team code is added when this row has one. */
export function confirmationSubject(a: { eventName: string; teamCode?: string | null }): string {
  const code = a.teamCode?.trim();
  return code ? `Your PRAVRUTTI ticket: ${a.eventName} · ${code}` : `Your PRAVRUTTI ticket: ${a.eventName}`;
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full.trim();
}

export type ConfirmationView = Pick<
  Application,
  "name" | "eventName" | "ticketId" | "fee" | "teamName" | "teamCode" | "paymentRef"
>;

export function confirmationHtml(a: ConfirmationView, ticketUrl: string) {
  const rows: [string, string][] = [
    ["Event", a.eventName],
    ["Ticket ID", a.ticketId],
    ["Dates", FEST.dates],
    ["Venue", FEST.venue],
    ["Entry fee", a.fee],
  ];
  if (a.teamName) rows.push(["Team", a.teamName]);
  if (a.teamCode?.trim()) rows.push(["Team code", a.teamCode.trim()]);
  if (a.paymentRef) rows.push(["Payment reference", a.paymentRef]);

  const cells = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 0;color:rgba(247,238,228,.55);font-size:13px;">${k}</td>
          <td style="padding:8px 0;color:${BRAND.cream};font-size:13px;font-weight:600;text-align:right;">${v}</td>
        </tr>`
    )
    .join("");

  const validity = ticketValidityLine(a.eventName);

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${BRAND.ink};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding-bottom:8px;color:${BRAND.pink};font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;">
      ${FEST.name}
    </td></tr>
    <tr><td style="background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:18px;padding:28px;">
      <h1 style="margin:0 0 10px;color:${BRAND.gold};font-size:22px;">You're confirmed, ${firstName(a.name)}</h1>
      <p style="margin:0 0 18px;color:rgba(247,238,228,.75);font-size:14px;line-height:1.6;">
        Your payment has been verified and your place at <strong style="color:${BRAND.cream};">${a.eventName}</strong>
        is booked. Your entry QR is attached to this email, and it also lives on your ticket page.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="margin:0 0 18px;background:rgba(242,210,174,.10);border:1px solid ${BRAND.gold};border-radius:12px;">
        <tr><td style="padding:12px 14px;color:${BRAND.cream};font-size:14px;line-height:1.55;font-weight:600;">
          ${validity}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};margin-bottom:22px;">
        ${cells}
      </table>

      <a href="${ticketUrl}"
         style="display:block;background:${BRAND.pink};color:#fff;text-decoration:none;text-align:center;
                padding:14px;border-radius:12px;font-weight:700;font-size:14px;">
        View my ticket &amp; QR
      </a>

      <p style="margin:18px 0 0;color:rgba(247,238,228,.5);font-size:12px;line-height:1.6;">
        Show the QR at the registration desk on the day. Keep this email — it is your proof of entry.
      </p>
    </td></tr>
    <tr><td style="padding-top:14px;color:rgba(247,238,228,.35);font-size:11px;text-align:center;">
      ${FEST.venue}
    </td></tr>
  </table>
</body></html>`;
}

export function confirmationText(a: ConfirmationView, ticketUrl: string) {
  return [
    `You're confirmed, ${firstName(a.name)}.`,
    ``,
    `Your payment has been verified and your place at ${a.eventName} is booked.`,
    ``,
    ticketValidityLine(a.eventName),
    ``,
    `Ticket ID: ${a.ticketId}`,
    `Event: ${a.eventName}`,
    `Dates: ${FEST.dates}`,
    `Venue: ${FEST.venue}`,
    `Entry fee: ${a.fee}`,
    a.teamName ? `Team: ${a.teamName}` : null,
    a.teamCode?.trim() ? `Team code: ${a.teamCode.trim()}` : null,
    a.paymentRef ? `Payment reference: ${a.paymentRef}` : null,
    ``,
    `Your QR is attached to this email, and you can also view it here:`,
    ticketUrl,
    ``,
    `Show the QR at the registration desk on the day.`,
    `${FEST.name} — ${FEST.venue}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
