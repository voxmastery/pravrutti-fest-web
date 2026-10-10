import type { Application } from "@/lib/applications";
import { ticketQrBase64 } from "@/lib/ticket-qr";
import { sendMail, siteOrigin, type SendResult } from "@/lib/mailer";
import { confirmationHtml, confirmationSubject, confirmationText } from "@/lib/ticket-copy";

/**
 * The "you're in" email.
 *
 * Carries the QR two ways on purpose: attached as a PNG so it survives an
 * offline phone at the gate, and behind a link to /ticket which is the copy
 * that can never go stale. Inline images are not used — Gmail and Outlook
 * both block them by default, and a blocked QR is a queue at the desk.
 *
 * The subject, the validity line, and the HTML all read eventName off this
 * registration. A second event for the same person is a different email.
 */
export async function sendConfirmationEmail(a: Application): Promise<SendResult> {
  const ticketUrl = `${siteOrigin()}/ticket`;
  const qr = await ticketQrBase64({
    ticketId: a.ticketId,
    eventId: a.eventId,
    email: a.email,
  });

  return sendMail({
    to: a.email,
    subject: confirmationSubject(a),
    html: confirmationHtml(a, ticketUrl),
    text: confirmationText(a, ticketUrl),
    attachments: [{ filename: `pravrutti-ticket-${a.ticketId}.png`, base64: qr }],
  });
}
