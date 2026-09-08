"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Event, eventId } from "@/lib/pravrutti-data";
import { downloadEventIcs } from "@/lib/event-calendar";
import { CalendarPlus, CalendarRange, Check, Download, Link2, Share2 } from "lucide-react";

/**
 * The "More" overflow, holding the actions that would otherwise each need a
 * button of their own on a 375px screen.
 *
 * Deliberately only things this site can actually do. The .ics comes from
 * lib/event-calendar so the entry a visitor keeps matches the one the ticket
 * page issues, and it names the campus rather than the hall for the reasons
 * given there.
 */
export function EventMoreSheet({
  event,
  open,
  onClose,
}: {
  event: Event;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const id = eventId(event.name);

  const url = () => `${window.location.origin}/events/${id}`;

  const share = async () => {
    const payload = {
      title: event.name,
      text: `Registrations are open for ${event.name}.`,
      url: url(),
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        onClose();
        return;
      } catch {
        /* dismissed — fall through to the clipboard, which always works */
      }
    }
    await copyLink();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const rows: { label: string; Icon: typeof Share2; run: () => void }[] = [
    { label: "Share this event", Icon: Share2, run: share },
    { label: copied ? "Link copied" : "Copy link", Icon: copied ? Check : Link2, run: copyLink },
    { label: "Add to calendar", Icon: CalendarPlus, run: () => { downloadEventIcs(event.name); onClose(); } },
    { label: "View the full schedule", Icon: CalendarRange, run: () => { onClose(); router.push("/schedule"); } },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-midnight-navy border-t-2 border-neon-purple text-pearl-white rounded-t-3xl p-0 gap-0 max-h-[85dvh] overflow-y-auto overscroll-contain"
      >
        <SheetTitle className="px-5 pt-5 pb-3 font-orbitron text-[10px] font-black uppercase tracking-[0.22em] text-pearl-white/45">
          {event.name}
        </SheetTitle>

        <ul className="px-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {rows.map(({ label, Icon, run }) => (
            <li key={label}>
              <button
                type="button"
                onClick={run}
                className="w-full min-h-[52px] flex items-center gap-3.5 px-3 rounded-2xl font-sharetech text-base text-pearl-white/85 hover:bg-cosmic-purple hover:text-pearl-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
              >
                <Icon className="w-4.5 h-4.5 shrink-0 text-cyber-pink" aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
          <li>
            <a
              href={event.brochureUrl}
              download={`${event.name}_Rules.pdf`}
              onClick={onClose}
              className="w-full min-h-[52px] flex items-center gap-3.5 px-3 rounded-2xl font-sharetech text-base text-pearl-white/85 hover:bg-cosmic-purple hover:text-pearl-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
            >
              <Download className="w-4.5 h-4.5 shrink-0 text-cyber-pink" aria-hidden="true" />
              Download the rulebook
            </a>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  );
}
