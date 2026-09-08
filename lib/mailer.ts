/**
 * Outbound mail, over Resend's HTTP API.
 *
 * HTTP rather than SMTP so there is no transport dependency to install and
 * nothing to keep warm between serverless invocations.
 *
 * Unconfigured is a first-class state, not an error: the fest can run its
 * whole review queue without a mail key, and an organiser marking a payment
 * verified must never fail because of a missing env var. Callers get
 * `{ sent: false, skipped: true }` and surface it in the UI.
 */

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

type Attachment = { filename: string; base64: string };

export const mailerConfigured = () => !!process.env.RESEND_API_KEY;

const FALLBACK_ORIGIN = "https://fest-web-main.vercel.app";

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

const from = () => process.env.MAIL_FROM ?? "Pravrutti <onboarding@resend.dev>";

export async function sendMail(mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  if (!mailerConfigured()) return { sent: false, skipped: true, error: "Mail is not configured." };

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
      // Trimmed: this string ends up on an organiser's screen, not in a log.
      return { sent: false, error: `Resend ${res.status}: ${detail.slice(0, 180)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Mail send failed." };
  }
}
