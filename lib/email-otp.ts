import { createHmac, randomInt, timingSafeEqual } from "crypto";

/**
 * Email one-time codes for people whose ticket address is not a Google inbox.
 *
 * The code is the only thing we email. Nothing here knows about tickets,
 * teams, or certificates — a successful check just proves the inbox, and the
 * session that follows is what the rest of the site already trusts.
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MIN_GAP_MS = 60 * 1000;
export const OTP_MAX_SENDS = 5;
export const OTP_WINDOW_MS = 60 * 60 * 1000;
export const OTP_IP_MAX = 20;

export type OtpRecord = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  sends: number[];
  consumed?: boolean;
};

export type IpHits = { hits: number[] };

export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 191) return null;
  if (/[\s<>]/.test(email)) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

export function newOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(email: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export function otpHashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function withinWindow(stamps: number[], now: number): number[] {
  return stamps.filter((t) => now - t >= 0 && now - t < OTP_WINDOW_MS).slice(-40);
}

export type IssueDecision =
  | { ok: true; record: OtpRecord }
  | { ok: false; reason: "too_soon" | "too_many"; retryAfterSec: number };

/** A new code replaces the previous one. The send window is what throttles. */
export function decideIssue(
  current: OtpRecord | null,
  email: string,
  codeHash: string,
  now: number,
): IssueDecision {
  const sends = withinWindow(current?.sends ?? [], now);
  const last = sends.length ? Math.max(...sends) : 0;
  if (last && now - last < OTP_MIN_GAP_MS) {
    return {
      ok: false,
      reason: "too_soon",
      retryAfterSec: Math.max(1, Math.ceil((OTP_MIN_GAP_MS - (now - last)) / 1000)),
    };
  }
  if (sends.length >= OTP_MAX_SENDS) {
    const oldest = Math.min(...sends);
    return {
      ok: false,
      reason: "too_many",
      retryAfterSec: Math.max(1, Math.ceil((OTP_WINDOW_MS - (now - oldest)) / 1000)),
    };
  }
  return {
    ok: true,
    record: {
      email,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      sends: [...sends, now],
    },
  };
}

export function decideIp(
  current: IpHits | null,
  now: number,
): { ok: true; next: IpHits } | { ok: false; retryAfterSec: number } {
  const hits = withinWindow(current?.hits ?? [], now);
  if (hits.length >= OTP_IP_MAX) {
    const oldest = Math.min(...hits);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((OTP_WINDOW_MS - (now - oldest)) / 1000)) };
  }
  return { ok: true, next: { hits: [...hits, now] } };
}

export type VerifyDecision =
  | { ok: true; email: string; write: true; next: OtpRecord }
  | { ok: false; error: string; write: boolean; next: OtpRecord | null };

export function decideVerify(
  current: OtpRecord | null,
  email: string,
  codeHash: string,
  now: number,
): VerifyDecision {
  if (!current || current.email !== email || current.consumed || !current.codeHash) {
    return {
      ok: false,
      error: "That code is wrong or has expired. Request a new one.",
      write: false,
      next: current,
    };
  }
  if (current.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many tries. Request a new code.", write: false, next: current };
  }
  if (now > current.expiresAt) {
    return { ok: false, error: "That code has expired. Request a new one.", write: false, next: current };
  }
  if (!otpHashesEqual(current.codeHash, codeHash)) {
    const attempts = current.attempts + 1;
    const dead = attempts >= OTP_MAX_ATTEMPTS;
    return {
      ok: false,
      error: dead ? "Too many tries. Request a new code." : "That code is wrong.",
      write: true,
      next: { ...current, attempts, codeHash: dead ? "" : current.codeHash },
    };
  }
  return {
    ok: true,
    email,
    write: true,
    next: { ...current, consumed: true, codeHash: "" },
  };
}

/** The only email this feature sends. No ticket, no QR, no event. */
export function otpMail(code: string): { subject: string; text: string; html: string } {
  const subject = "Your Pravrutti sign-in code";
  const text = [
    `Your Pravrutti sign-in code is ${code}.`,
    "It expires in 10 minutes.",
    "",
    "If you didn't ask for this, you can ignore this email.",
  ].join("\n");
  const html = [
    `<p>Your Pravrutti sign-in code is <strong style="letter-spacing:0.18em">${code}</strong>.</p>`,
    "<p>It expires in 10 minutes.</p>",
    "<p>If you didn't ask for this, you can ignore this email.</p>",
  ].join("");
  return { subject, text, html };
}

export function issueErrorMessage(reason: "too_soon" | "too_many"): string {
  if (reason === "too_soon") return "Wait a minute before asking for another code.";
  return "Too many codes were sent to that address. Try again in a little while.";
}
