import { createHash } from "crypto";
import { casUpdate } from "@/lib/blob-store";
import { mailerConfigured, sendMail } from "@/lib/mailer";
import {
  decideIp,
  decideIssue,
  decideVerify,
  hashOtpCode,
  issueErrorMessage,
  newOtpCode,
  normalizeLoginEmail,
  otpMail,
  type IpHits,
  type OtpRecord,
} from "@/lib/email-otp";

/**
 * Issues and consumes sign-in codes.
 *
 * Both writes go through the same compare-and-swap the desk uses, so two
 * requests for one inbox cannot each mint a live code. The mail call is the
 * only outbound message, and it happens after the code is stored.
 */

function emailPath(email: string) {
  return `login-otp/${createHash("sha256").update(email).digest("hex").slice(0, 32)}.json`;
}

function ipPath(ip: string) {
  return `login-otp-ip/${createHash("sha256").update(ip).digest("hex").slice(0, 32)}.json`;
}

export function otpSecret(): string | null {
  const secret = process.env.OTP_SECRET || process.env.NEXTAUTH_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export type OtpRequestResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function requestEmailOtp(emailRaw: unknown, ip: string, now = Date.now()): Promise<OtpRequestResult> {
  const email = normalizeLoginEmail(emailRaw);
  if (!email) return { ok: false, status: 400, error: "Enter a valid email address." };
  if (!mailerConfigured() || !otpSecret()) {
    return { ok: false, status: 503, error: "Sign-in codes aren't available right now." };
  }

  const ipDecision = { blocked: "" };
  await casUpdate<IpHits>(ipPath(ip.slice(0, 64) || "unknown"), (current) => {
    const decision = decideIp(current, now);
    if (!decision.ok) {
      ipDecision.blocked = `Too many codes were requested from this network. Try again in ${decision.retryAfterSec}s.`;
      return { write: false, next: current };
    }
    return { write: true, next: decision.next };
  });
  if (ipDecision.blocked) return { ok: false, status: 429, error: ipDecision.blocked };

  const secret = otpSecret()!;
  const code = newOtpCode();
  const codeHash = hashOtpCode(email, code, secret);
  const held: { error?: string } = {};
  await casUpdate<OtpRecord>(emailPath(email), (current) => {
    const decision = decideIssue(current, email, codeHash, now);
    if (!decision.ok) {
      held.error = issueErrorMessage(decision.reason);
      return { write: false, next: current };
    }
    return { write: true, next: decision.record };
  });
  if (held.error) return { ok: false, status: 429, error: held.error };

  const mail = otpMail(code);
  const sent = await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
  if (!sent.sent) {
    await casUpdate<OtpRecord>(emailPath(email), (current) => {
      if (!current || current.codeHash !== codeHash) return { write: false, next: current };
      return { write: true, next: { ...current, codeHash: "", consumed: true } };
    });
    return { ok: false, status: 503, error: "We couldn't send the code. Try again in a moment." };
  }
  return { ok: true };
}

export type OtpConsumeResult = { ok: true; email: string } | { ok: false; error: string };

export async function consumeEmailOtp(emailRaw: unknown, codeRaw: unknown, now = Date.now()): Promise<OtpConsumeResult> {
  const email = normalizeLoginEmail(emailRaw);
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code from your email." };
  }
  const secret = otpSecret();
  if (!secret) return { ok: false, error: "Sign-in codes aren't available right now." };

  const codeHash = hashOtpCode(email, code, secret);
  const held: { result?: OtpConsumeResult } = {};
  await casUpdate<OtpRecord>(emailPath(email), (current) => {
    const decision = decideVerify(current, email, codeHash, now);
    if (decision.ok) {
      held.result = { ok: true, email: decision.email };
      return { write: true, next: decision.next };
    }
    held.result = { ok: false, error: decision.error };
    if (!decision.write || !decision.next) return { write: false, next: current };
    return { write: true, next: decision.next };
  });
  return held.result ?? { ok: false, error: "That code is wrong or has expired. Request a new one." };
}
