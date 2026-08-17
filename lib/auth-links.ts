/**
 * Destinations for the Login / Register buttons.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POINT THESE AT THE REAL REGISTRATION PLATFORM.
 *
 * This site has no accounts of its own — no auth, no user records, no password
 * handling. The buttons therefore point at real, useful pages on this site so
 * nothing is broken today:
 *
 *   login    -> /tickets  (explains registration status + "check your email")
 *   register -> /events   (browse and enter events)
 *
 * When registration goes live on Unstop (or wherever), change the two values
 * below to those URLs and set `external: true`. Every Login/Register button in
 * the nav — desktop and mobile — reads from here, so this is the only edit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const AUTH_LINKS = {
  login: "/tickets",
  register: "/events",
  /** Set true once the URLs above are off-site, so links open in a new tab. */
  external: false,
} as const;

/** Props spread onto an <a>/<Link> so off-site links open safely in a new tab. */
export const externalLinkProps = AUTH_LINKS.external
  ? { target: "_blank" as const, rel: "noopener noreferrer" }
  : {};
