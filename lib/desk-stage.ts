/**
 * Where one roster row sits on the coordinator's desk.
 *
 * The event page and this desk have to answer "in review" with the same
 * people. A held pending registration is in review — paid, quoted a payment
 * ID, or left for the portal, which the organisers hold until the payment
 * report says otherwise. Pending but not held (the lead never registered, or
 * they withdrew) is not in review: nobody is looking at it, and it fills no
 * seat on the event page either.
 */

export type DeskStage = "confirmed" | "review" | "unfinished" | "withdrew";

export function deskStage(p: { status: string; live: boolean }): DeskStage {
  if (p.status === "confirmed") return "confirmed";
  if (p.status === "invited") return "unfinished";
  if (p.status === "pending") return p.live ? "review" : "unfinished";
  return "withdrew";
}
