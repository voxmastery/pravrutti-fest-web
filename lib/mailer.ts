import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound mail. Two transports, tried in this order:
 *
 *   1. SMTP   — the college's own mailbox (no-reply@pravrutti.tech on
 *               Hostinger). Preferred: pravrutti.tech already publishes SPF,
 *               DKIM and DMARC for Hostinger's servers, so mail sent this way
 *               is authenticated as the domain it claims to come from.
 *   2. Resend — HTTP fallback, kept so a deployment without SMTP can still send.
 *
 * Unconfigured is a first-class state, not an error: the fest can run its whole
 * review queue without mail, and an organiser marking a payment verified must
 * never fail because of a missing env var. Callers get
 * `{ sent: false, skipped: true }` and surface it in the UI.
 */

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

type Attachment = { filename: string; base64: string };

export const smtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const mailerConfigured = () => smtpConfigured() || !!process.env.RESEND_API_KEY;

const FALLBACK_ORIGIN = "https://pravrutti.tech";

/** Absolute origin for links in email, where a relative path is useless. */
export function siteOrigin() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);

  if (!candidate) return FALLBACK_ORIGIN;
  try {
    return new URL(candidate).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

const from = () =>
  process.env.MAIL_FROM ??
  (process.env.SMTP_USER ? `Pravrutti 2026 <${process.env.SMTP_USER}>` : "Pravrutti <onboarding@resend.dev>");

/**
 * One transporter per process, reused across invocations.
 *
 * Port 465 is implicit TLS (`secure: true`); 587 negotiates STARTTLS and must
 * not set it. Getting this pair wrong is the usual cause of a connection that
 * hangs until timeout rather than failing outright.
 */
let cached: Transporter | null = null;
function transporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

/** Proves the credentials and the host/port pair before anything depends on
    them. Returns the same shape as a send so callers treat it the same way. */
export async function verifyMailer(): Promise<SendResult> {
  if (!smtpConfigured()) return { sent: false, skipped: true, error: "SMTP is not configured." };
  try {
    await transporter().verify();
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "SMTP verify failed." };
  }
}

async function sendViaSmtp(mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  try {
    await transporter().sendMail({
      from: from(),
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.base64, "base64"),
      })),
    });
    return { sent: true };
  } catch (e) {
    // Trimmed: this string ends up on an organiser's screen, not in a log.
    const detail = e instanceof Error ? e.message : "SMTP send failed.";
    return { sent: false, error: detail.slice(0, 180) };
  }
}

async function sendViaResend(mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: a.base64,
        })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, error: `Resend ${res.status}: ${detail.slice(0, 180)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
  }
}

export async function sendMail(mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  if (smtpConfigured()) return sendViaSmtp(mail);
  if (process.env.RESEND_API_KEY) return sendViaResend(mail);
  return { sent: false, skipped: true, error: "Mail is not configured." };
}
