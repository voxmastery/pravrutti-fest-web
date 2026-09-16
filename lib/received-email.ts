import { FEST } from "@/lib/pravrutti-data";
import type { Application } from "@/lib/applications";
import { sendMail, siteOrigin, type SendResult } from "@/lib/mailer";
import { PALETTE } from "@/lib/palette";

/**
 * The acknowledgement that goes out the moment an application is submitted.
 *
 * Distinct from the confirmation: nothing is booked yet and no QR exists, so
 * this promises nothing it cannot keep. Its whole job is to close the loop —
 * somebody has just paid ₹200 on a third-party portal and pasted a reference
 * into a form, and silence after that reads like the money went nowhere.
 *
 * It states what was received, what happens next, and what NOT to do (pay
 * again), because a second payment is the expensive mistake this prevents.
 */

function firstName(full: string) {
  const first = full.trim().split(/\s+/)[0] ?? "";
  return first || "there";
}

const BRAND = {
  ink: PALETTE.midnightNavy,
  panel: PALETTE.cosmicPurple,
  line: PALETTE.royalWine,
  cream: PALETTE.pearlWhite,
  gold: PALETTE.champagneGold,
  pink: PALETTE.cyberPink,
};

function rowsFor(a: Application): [string, string][] {
  const rows: [string, string][] = [
    ["Event", a.eventName],
    ["Reference", a.ticketId],
    ["Dates", FEST.dates],
    ["Venue", FEST.venue],
    ["Entry fee", a.fee],
  ];
  if (a.teamName) rows.push(["Team", a.teamName]);
  if (a.teamCode) rows.push(["Team code", a.teamCode]);
  if (a.paymentRef) rows.push(["Transaction ID", a.paymentRef]);
  return rows;
}

function html(a: Application, ticketUrl: string) {
  const cells = rowsFor(a)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 0;color:rgba(247,238,228,.55);font-size:13px;">${k}</td>
          <td style="padding:8px 0;color:${BRAND.cream};font-size:13px;font-weight:600;text-align:right;">${v}</td>
        </tr>`
    )
    .join("");

  const teamLine = a.teamCode
    ? `<p style="margin:0 0 18px;color:rgba(247,238,228,.6);font-size:13px;line-height:1.6;">
         Share your team code <strong style="color:${BRAND.cream};letter-spacing:.08em;">${a.teamCode}</strong>
         so teammates can join — they do not pay, you have covered the team.
       </p>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${BRAND.ink};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding-bottom:8px;color:${BRAND.pink};font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;">
      ${FEST.name}
    </td></tr>
    <tr><td style="background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:18px;padding:28px;">
      <h1 style="margin:0 0 10px;color:${BRAND.gold};font-size:22px;">We have your application, ${firstName(a.name)}</h1>
      <p style="margin:0 0 18px;color:rgba(247,238,228,.75);font-size:14px;line-height:1.6;">
        Your application for <strong style="color:${BRAND.cream};">${a.eventName}</strong> is in the queue and
        we are verifying your payment against the college portal's statement.
        <strong style="color:${BRAND.cream};">Please do not pay again.</strong>
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};margin-bottom:22px;">
        ${cells}
      </table>

      ${teamLine}

      <a href="${ticketUrl}"
         style="display:block;background:${BRAND.pink};color:#fff;text-decoration:none;text-align:center;
                padding:14px;border-radius:12px;font-weight:700;font-size:14px;">
        Track my application
      </a>

      <p style="margin:18px 0 0;color:rgba(247,238,228,.5);font-size:12px;line-height:1.6;">
        Once your payment is verified we will email your ticket and entry QR. If the event fills up before
        then, your fee comes back to you in full. Nothing more is needed from you right now.
      </p>
    </td></tr>
    <tr><td style="padding-top:14px;color:rgba(247,238,228,.35);font-size:11px;text-align:center;">
      ${FEST.venue}
    </td></tr>
  </table>
</body></html>`;
}

function text(a: Application, ticketUrl: string) {
  const lines = [
    `We have your application, ${firstName(a.name)}.`,
    ``,
    `Your application for ${a.eventName} is in the queue and we are verifying your`,
    `payment against the college portal's statement. Please do not pay again.`,
    ``,
    ...rowsFor(a).map(([k, v]) => `${k}: ${v}`),
    ``,
    `Track it: ${ticketUrl}`,
    ``,
    `Once your payment is verified we will email your ticket and entry QR. If the`,
    `event fills up before then, your fee comes back to you in full.`,
    ``,
    `${FEST.name} — ${FEST.venue}`,
  ];
  return lines.join("\n");
}

/** Never throws: a failed acknowledgement must not undo a saved application. */
export async function sendReceivedEmail(a: Application): Promise<SendResult> {
  const ticketUrl = `${siteOrigin()}/ticket`;
  try {
    return await sendMail({
      to: a.email,
      subject: `Application received for ${a.eventName} — ${FEST.name}`,
      html: html(a, ticketUrl),
      text: text(a, ticketUrl),
    });
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
  }
}
