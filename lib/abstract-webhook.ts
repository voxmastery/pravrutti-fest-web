import { createHmac, timingSafeEqual } from "crypto";

/**
 * The shared secret the Google Form's Apps Script signs its call with.
 *
 * Derived from ADMIN_KEY rather than stored as a second environment variable:
 * Hostinger replaces the whole env set at once and masks it back, so every
 * new variable is a deployment risk and a thing to lose. Deriving it means
 * there is nothing new to store, the script never holds the admin key itself,
 * and rotating ADMIN_KEY rotates this too.
 *
 * What the token can do if it leaks is bounded on purpose: mark a Discoverize
 * abstract as received. It cannot read a roster, take a payment, or confirm a
 * place.
 */
export function abstractWebhookToken(adminKey = process.env.ADMIN_KEY): string | null {
  if (!adminKey) return null;
  return createHmac("sha256", adminKey).update("discoverize:abstract-webhook:v1").digest("hex").slice(0, 40);
}

/** Constant-time compare, so a wrong token cannot be found a byte at a time. */
export function tokenMatches(presented: unknown, expected: string | null): boolean {
  if (!expected || typeof presented !== "string") return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
