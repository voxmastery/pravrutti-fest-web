import { FEST } from "@/lib/pravrutti-data";

/**
 * Downloads an .ics for one event.
 *
 * Shared by the ticket list and the event page's "More" sheet. Both used to be
 * the only caller of their own copy; two copies meant two chances for the
 * calendar entry a participant actually keeps to disagree with the site.
 *
 * LOCATION is deliberately the campus, never the exact hall. A calendar entry
 * outlives the gate around lib/event-venues.ts — it syncs to phones, gets
 * shared, and is read by whatever the participant's calendar provider is —
 * and the campus is what someone needs to find the gate on the morning.
 *
 * `ticketId` is present only for a confirmed participant, so the reminder they
 * keep carries the code the desk will ask for.
 */
export function downloadEventIcs(eventName: string, ticketId?: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
  const uid = ticketId ?? `${eventName.replace(/\s+/g, "-").toLowerCase()}-${stamp}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pravrutti//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@pravrutti`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART:${FEST.startUtc}`,
    `DTEND:${FEST.endUtc}`,
    `SUMMARY:${eventName} - ${FEST.name}`,
    `LOCATION:${FEST.venue}`,
    ticketId
      ? `DESCRIPTION:Ticket ${ticketId}. Show your QR at the registration desk.`
      : "DESCRIPTION:Check the schedule page for the exact timing of this event.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${eventName.replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
