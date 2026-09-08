import { redirect } from "next/navigation";

/**
 * The scanner moved to /dashboard/scan.
 *
 * It never belonged under /admin: that path is the old shared-password
 * console, while the scanner is role-gated and coordinators use it too —
 * calling them admins was wrong on both counts.
 *
 * This redirect stays because the old path may already be bookmarked on a
 * volunteer's phone, and a 404 at the gate on the day is not a trade worth
 * making for a tidier route list.
 */
export default function LegacyScanRedirect() {
  redirect("/dashboard/scan");
}
