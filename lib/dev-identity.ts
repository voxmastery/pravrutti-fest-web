/**
 * Local-only sign-in override.
 *
 * Lets you open /dashboard and /dashboard/scan on a dev machine without a Google
 * round-trip. It exists because the dashboards are the hardest surfaces to
 * inspect — every view behind them needs a real session and a real role.
 *
 * The guard is deliberately two-part:
 *
 *   1. `process.env.NODE_ENV !== "production"` — Next inlines NODE_ENV at
 *      build time, so in a production build this whole branch is a literal
 *      `false` and the bundler removes it. The code is not merely unreachable
 *      in production, it is not present.
 *   2. An address must actually be supplied, so a dev build with no override
 *      configured still behaves exactly like production.
 *
 * Both must hold. Neither alone is enough, and the production check comes
 * first so that setting the variable on a deployed build does nothing.
 */

/** Cookie the demo buttons set. Read by both server and client in dev only. */
export const DEV_LOGIN_COOKIE = "pravrutti_dev_login";

export function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function devImpersonatedEmail(
  env: { NODE_ENV?: string; email?: string } = {
    NODE_ENV: process.env.NODE_ENV,
    email: process.env.DEV_LOGIN_EMAIL,
  }
): string | null {
  if (env.NODE_ENV === "production") return null;
  const email = env.email?.trim();
  return email ? email.toLowerCase() : null;
}

/**
 * Pulls the override out of a raw Cookie header.
 *
 * Cookie-based rather than env-only so the demo buttons can switch role
 * without restarting the server — an env var is read once at boot.
 */
export function devEmailFromCookieHeader(header: string | null | undefined): string | null {
  if (!isDev() || !header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === DEV_LOGIN_COOKIE) {
      const v = decodeURIComponent(rest.join("=")).trim();
      return v ? v.toLowerCase() : null;
    }
  }
  return null;
}

/** Client-side twin: env var first, then the cookie the demo buttons set. */
export function devImpersonatedEmailClient(): string | null {
  if (!isDev()) return null;
  const fromEnv = devImpersonatedEmail({
    NODE_ENV: process.env.NODE_ENV,
    email: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL,
  });
  if (fromEnv) return fromEnv;
  if (typeof document === "undefined") return null;
  return devEmailFromCookieHeader(document.cookie);
}

/** Sets the cookie and reloads, so both server and client pick up the new role. */
export function setDevLogin(email: string | null) {
  if (!isDev() || typeof document === "undefined") return;
  document.cookie = email
    ? `${DEV_LOGIN_COOKIE}=${encodeURIComponent(email)}; path=/; SameSite=Lax`
    : `${DEV_LOGIN_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  window.location.reload();
}
