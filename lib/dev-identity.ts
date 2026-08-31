/**
 * Local-only sign-in override.
 *
 * Lets you open /dashboard and /admin/scan on a dev machine without a Google
 * round-trip. It exists because the dashboards are the hardest surfaces to
 * inspect — every view behind them needs a real session and a real role.
 *
 * The guard is deliberately two-part:
 *
 *   1. `process.env.NODE_ENV !== "production"` — Next inlines NODE_ENV at
 *      build time, so in a production build this whole branch is a literal
 *      `false` and the bundler removes it. The code is not merely unreachable
 *      in production, it is not present.
 *   2. The variable must be set at all, so a dev build with no override
 *      configured still behaves exactly like production.
 *
 * Both must hold. Neither alone is enough, and the production check comes
 * first so that setting the variable on a deployed build does nothing.
 */
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

/** Client-side twin. Needs the NEXT_PUBLIC_ copy to reach the browser. */
export function devImpersonatedEmailClient(): string | null {
  return devImpersonatedEmail({
    NODE_ENV: process.env.NODE_ENV,
    email: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL,
  });
}
