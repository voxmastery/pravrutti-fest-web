import { ticketValidityLine } from "@/lib/ticket-copy";

/**
 * The same sentence as the confirmation email, on My Tickets and the QR card.
 * `eventName` is the registration row's own event, not the page the person opened.
 */
export function TicketValidityNote({ eventName, className }: { eventName: string; className?: string }) {
  const line = ticketValidityLine(eventName);
  const marker = `This ticket is only valid for ${eventName}.`;
  const rest = line.startsWith(marker) ? line.slice(marker.length).trimStart() : "";

  return (
    <p
      className={`min-w-0 break-words rounded-xl border border-soft-gold/30 bg-soft-gold/[0.07] px-3 py-2.5 text-[13px] leading-relaxed text-white/80 ${className ?? ""}`}
    >
      <span className="font-semibold text-champagne-gold">This ticket is only valid for {eventName}.</span>
      {rest ? ` ${rest}` : null}
    </p>
  );
}
