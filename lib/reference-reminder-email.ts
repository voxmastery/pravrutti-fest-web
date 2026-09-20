import { readFile } from "fs/promises";
import path from "path";
import { FEST } from "@/lib/pravrutti-data";
import type { Application } from "@/lib/applications";
import { sendMail, siteOrigin, type Attachment, type SendResult } from "@/lib/mailer";
import { PALETTE } from "@/lib/palette";

/**
 * The nudge for somebody pending on a payment we have nothing to match.
 *
 * They went to the college portal and came back without the Transaction
 * Reference No — or did not come back at all. Either way the mail is the
 * same: one button that lands on the event's payment screen, which asks how
 * it went and takes the reference. JUNO's receipt is shown inline with the
 * right row highlighted, because the IDs that came in before were GPay's and
 * PhonePe's, which an organiser cannot match to anything.
 */

const RECEIPT_CID = "juno-receipt";
const RECEIPT_FILE = path.join(process.cwd(), "public", "images", "juno-receipt-reference.png");

const BRAND = {
  ink: PALETTE.midnightNavy,
  panel: PALETTE.cosmicPurple,
  line: PALETTE.royalWine,
  cream: PALETTE.pearlWhite,
  gold: PALETTE.champagneGold,
  pink: PALETTE.cyberPink,
};

function firstName(full: string) {
  const first = (full ?? "").trim().split(/\s+/)[0] ?? "";
  return first || "there";
}

/** Read once per process; a missing file drops the picture, never the mail. */
let receiptBase64: Promise<string | null> | null = null;
function receipt(): Promise<string | null> {
  if (!receiptBase64) {
    receiptBase64 = readFile(RECEIPT_FILE)
      .then((b) => b.toString("base64"))
      .catch(() => null);
  }
  return receiptBase64;
}

export function reminderLink(a: Application) {
  return `${siteOrigin()}/events/${encodeURIComponent(a.eventId)}?finish=reference`;
}

function copyFor(a: Application) {
  return {
    subject: `Confirm your registration for ${a.eventName} — ${FEST.name}`,
    heading: `Confirm your registration, ${firstName(a.name)}`,
    lead: `You went to the college portal to pay for <strong style="color:${BRAND.cream};">${a.eventName}</strong>. To confirm your registration, add the <strong style="color:${BRAND.cream};">Transaction Reference No</strong> from JUNO's receipt — it is how we match your payment to your place. If the payment did not go through, the same page lets you say so and try again.`,
    leadText: `You went to the college portal to pay for ${a.eventName}. To confirm your registration, add the Transaction Reference No from JUNO's receipt — it is how we match your payment to your place. If the payment did not go through, the same page lets you say so and try again.`,
    button: "Confirm my registration",
  };
}

function html(a: Application, link: string, withImage: boolean) {
  const c = copyFor(a);
  const picture = withImage
    ? `<img src="cid:${RECEIPT_CID}" width="504" alt="JUNO's Online Payment Receipt with the Transaction Reference No row highlighted"
            style="display:block;width:100%;max-width:504px;height:auto;border-radius:10px;border:1px solid ${BRAND.line};margin:0 0 18px;">`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${BRAND.ink};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding-bottom:8px;color:${BRAND.pink};font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;">
      ${FEST.name}
    </td></tr>
    <tr><td style="background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:18px;padding:28px;">
      <h1 style="margin:0 0 10px;color:${BRAND.gold};font-size:22px;">${c.heading}</h1>
      <p style="margin:0 0 18px;color:rgba(247,238,228,.75);font-size:14px;line-height:1.6;">${c.lead}</p>

      <a href="${link}"
         style="display:block;background:${BRAND.pink};color:#fff;text-decoration:none;text-align:center;
                padding:14px;border-radius:12px;font-weight:700;font-size:14px;margin-bottom:22px;">
        ${c.button}
      </a>

      <p style="margin:0 0 10px;color:rgba(247,238,228,.75);font-size:13px;line-height:1.6;">
        When a payment finishes, JUNO shows an <strong style="color:${BRAND.cream};">Online Payment Receipt</strong>.
        The <strong style="color:${BRAND.cream};">Transaction Reference No</strong> is its first row.
        It is not your GPay, PhonePe or Paytm transaction ID — those we cannot match to anything.
      </p>
      ${picture}

      <p style="margin:0;color:rgba(247,238,228,.5);font-size:12px;line-height:1.6;">
        Reference ${a.ticketId}. <strong style="color:rgba(247,238,228,.7);">Please do not pay again.</strong>
        If the button does not open, copy this link: ${link}
      </p>
    </td></tr>
    <tr><td style="padding-top:14px;color:rgba(247,238,228,.35);font-size:11px;text-align:center;">
      ${FEST.venue}
    </td></tr>
  </table>
</body></html>`;
}

function text(a: Application, link: string) {
  const c = copyFor(a);
  return [
    c.heading,
    ``,
    c.leadText,
    ``,
    `${c.button}: ${link}`,
    ``,
    `When a payment finishes, JUNO shows an Online Payment Receipt. The Transaction`,
    `Reference No is its first row. It is not your GPay, PhonePe or Paytm`,
    `transaction ID.`,
    ``,
    `Reference ${a.ticketId}. Please do not pay again.`,
    ``,
    `${FEST.name} — ${FEST.venue}`,
  ].join("\n");
}

/** The rendered mail, for previews and tests. `withImage` is whether the
    receipt is attached inline; without it the HTML simply omits the picture. */
export function renderReferenceReminder(a: Application, withImage = true) {
  const link = reminderLink(a);
  return { subject: copyFor(a).subject, html: html(a, link, withImage), text: text(a, link) };
}

/** Never throws: a reminder that fails to send is a count, not an outage. */
export async function sendReferenceReminder(a: Application): Promise<SendResult> {
  const base64 = await receipt();
  const attachments: Attachment[] = base64
    ? [{ filename: "juno-receipt-reference.png", base64, contentType: "image/png", cid: RECEIPT_CID }]
    : [];
  const mail = renderReferenceReminder(a, attachments.length > 0);
  try {
    return await sendMail({ to: a.email, ...mail, attachments });
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
  }
}
