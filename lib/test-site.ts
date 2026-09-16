/**
 * The Vercel test-site switch.
 *
 * pravrutti.tech (Hostinger) and the Vercel deployment run the same code. This
 * one flag, set ONLY on the Vercel project (NEXT_PUBLIC_TEST_SITE=1), turns that
 * deployment into a walkable test site without a database:
 *
 *   1. registration is open        (effectiveRegistrationState, lib/pravrutti-data)
 *   2. the store is in-memory       (lib/mem-store — Vercel has no MySQL)
 *   3. sign-in runs as a guest      (identity provider skips Google)
 *
 * It is unset on Hostinger, so pravrutti.tech is untouched: registration keeps
 * its real "upcoming" state and writes still go to MySQL. The in-memory store is
 * ephemeral by design — a serverless instance keeps it only for its own warm
 * lifetime — which is fine for walking submit → "under review", and is why this
 * is never a production backend. Never set NEXT_PUBLIC_TEST_SITE on Hostinger.
 */
export const TEST_SITE = process.env.NEXT_PUBLIC_TEST_SITE === "1";
