import { redirect } from "next/navigation";

/**
 * The old address for a student's tickets, from before there was a backend.
 *
 * The page that lived here said "No registrations yet" to everyone, and the
 * footer linked it — so a confirmed student was told they had nothing. The
 * address is in WhatsApp groups now, so it stays, and takes them to the page
 * that actually has their QR codes.
 */
export default function TicketsPage() {
  redirect("/ticket");
}
