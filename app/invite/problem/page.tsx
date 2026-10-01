import Link from "next/link";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { MailWarning } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Where a dead invite link lands.
 *
 * Each reason gets its own sentence because they call for different actions:
 * a link whose team was dissolved is nobody's mistake, while a link already
 * spent usually means the member is on the team and simply lost the tab.
 */
const REASONS: Record<string, { title: string; blurb: string }> = {
  "bad-token": {
    title: "That invite link is incomplete",
    blurb:
      "The link may have been cut in half by the email client. Try opening it from the original message, or ask your team lead to send it again.",
  },
  unknown: {
    title: "We can't find that invitation",
    blurb:
      "It may have been cancelled, or the link may be mistyped. Ask your team lead to add you again — it takes them a moment.",
  },
  spent: {
    title: "That invitation has already been used",
    blurb:
      "If you left the team or your lead removed you, the link stops working. Ask them to add you again if that was not what you meant.",
  },
  "team-gone": {
    title: "That team no longer exists",
    blurb:
      "The team lead deleted it, so there is nothing left to join. You can still register for the event yourself, or ask them to create it again.",
  },
  full: {
    title: "This event is full",
    blurb:
      "It isn't taking new teams, and your team lead hasn't completed the team's registration. Your invite stays valid — if the event reopens, the same link will work.",
  },
  error: {
    title: "Something went wrong opening that invite",
    blurb: "Try the link once more. If it still fails, ask your team lead to send a fresh one.",
  },
};

export default async function InviteProblemPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = REASONS[String(reason ?? "")] ?? REASONS.unknown;

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      <section className="relative z-10 px-6 py-24 flex-1 flex items-center">
        <div className="max-w-[560px] mx-auto w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-cosmic-purple border border-royal-wine flex items-center justify-center mx-auto mb-6">
            <MailWarning className="w-6 h-6 text-champagne-gold" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-3">{copy.title}</h1>
          <p className="text-sm text-pearl-white/60 leading-relaxed mb-8">{copy.blurb}</p>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-xl bg-cyber-pink px-6 py-3 font-display text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 transition-opacity"
          >
            Browse events
          </Link>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
