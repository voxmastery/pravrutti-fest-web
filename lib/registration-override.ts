/**
 * Environment override that opens registration on the Vercel test site while it
 * stays closed on pravrutti.tech.
 *
 * The two deployments run the same code and share the same MySQL, so the only
 * difference is this flag: set NEXT_PUBLIC_REGISTRATION_OPEN=1 on the Vercel
 * project and its dialog is live for testing; leave it unset on Hostinger and
 * registration keeps its real state ("upcoming" until the announced date).
 *
 * It changes ONLY whether registration is open — nothing about auth or storage,
 * so a registration made on the test site is a real row in the real database
 * (delete test rows afterwards). Never set this on the Hostinger deploy.
 */
export const REGISTRATION_OPEN_OVERRIDE =
  process.env.NEXT_PUBLIC_REGISTRATION_OPEN === "1";
