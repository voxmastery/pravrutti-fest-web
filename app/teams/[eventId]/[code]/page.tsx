import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { events, eventId as slugFor, FEST } from "@/lib/pravrutti-data";
import { HACKTIVATE_EVENT_ID } from "@/lib/track-pick";
import { Team, TeamMember, memberStatus, normalizeTeamCode, maxTeamSizeFor } from "@/lib/teams";
import { readJsonByPath, teamPath, listTeamMembers } from "@/lib/blob-store";
import { TeamLeaveButton } from "@/components/team-leave-button";
import { CalendarDays, MapPin, Users } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A team's own page — where an accepted invite lands.
 *
 * Deliberately readable by anyone holding the link: the roster it shows is
 * names and confirmation status, nothing that would hurt to share. Phones,
 * colleges and emails stay on the server, because this URL travels through
 * WhatsApp groups and inboxes.
 *
 * The one privileged action here is leaving, and that needs the invite token —
 * the page renders the button only for the member whose token is in the URL.
 */

type Params = { eventId: string; code: string };

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { eventId: evId, code: rawCode } = await params;
  const { t } = await searchParams;
  const code = normalizeTeamCode(rawCode);

  const event = events.find((e) => slugFor(e.name) === evId);
  if (!event) notFound();

  const team = (await readJsonByPath(teamPath(evId, code))) as Team | null;
  if (!team || team.deletedAt || team.eventId !== evId) notFound();

  const roster: TeamMember[] = await listTeamMembers(evId, code);
  const cap = maxTeamSizeFor(event);

  const token = String(t ?? "").trim().toLowerCase();
  const me = token ? roster.find((m) => m.inviteToken === token) : undefined;
  /* A token is burned on accept, so after accepting it no longer matches any
     member's record. The pointer still resolves server-side, which is what the
     leave action checks — the button is offered whenever a token is present. */
  const viewerToken = /^[a-f0-9]{64}$/.test(token) ? token : "";

  const accepted = roster.filter((m) => memberStatus(m) === "joined").length;

  return (
    <main className="relative min-h-screen bg-transparent overflow-x-hidden text-pearl-white flex flex-col justify-between">
      <Navigation />

      <section className="relative z-10 px-5 sm:px-6 py-16 sm:py-24 flex-1">
        <div className="max-w-[640px] mx-auto w-full">
          <Link
            href={`/events/${evId}`}
            className="inline-flex items-center gap-2 text-xs font-display uppercase tracking-widest text-pearl-white/50 hover:text-champagne-gold transition-colors mb-6"
          >
            ← {event.name}
          </Link>

          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-cyber-pink mb-2">
            Your team
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 break-words">
            {team.name}
          </h1>
          {team.bio ? (
            <p className="text-sm text-pearl-white/60 leading-relaxed mb-6">{team.bio}</p>
          ) : null}

          {evId === HACKTIVATE_EVENT_ID && (
            <Link
              href="/hacktivate/track"
              className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-cyber-pink/40 bg-cyber-pink/10 px-4 py-3 text-sm hover:border-cyber-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
            >
              <span>
                <span className="block font-semibold text-champagne-gold">Pick your track</span>
                <span className="text-white/55">Opens 11 Oct, 9:30 AM IST. Only the lead can lock it.</span>
              </span>
            </Link>
          )}

          <div className="rounded-2xl border border-royal-wine bg-cosmic-purple/60 p-5 mb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-pearl-white/70">
              <CalendarDays className="w-4 h-4 shrink-0 text-champagne-gold" aria-hidden="true" />
              <span>{FEST.dates}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-pearl-white/70">
              <MapPin className="w-4 h-4 shrink-0 text-champagne-gold" aria-hidden="true" />
              <span>{FEST.venue}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-pearl-white/70">
              <Users className="w-4 h-4 shrink-0 text-champagne-gold" aria-hidden="true" />
              <span>
                {roster.length} of {cap} {cap === 1 ? "place" : "places"} taken
                {accepted < roster.length ? ` · ${accepted} confirmed` : ""}
              </span>
            </div>
          </div>

          <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-pearl-white/45 mb-3">
            Members
          </h2>
          <ul className="space-y-2 mb-8">
            {roster.map((m) => {
              const status = memberStatus(m);
              const isLead = m.email === team.createdByEmail;
              return (
                <li
                  key={m.email}
                  className="flex items-center gap-3 rounded-xl border border-royal-wine/70 bg-cosmic-purple/40 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.name}</span>
                  {isLead ? (
                    <span className="shrink-0 rounded-full border border-champagne-gold/40 px-2.5 py-0.5 text-[10px] font-display uppercase tracking-widest text-champagne-gold">
                      Lead
                    </span>
                  ) : null}
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-display uppercase tracking-widest ${
                      status === "joined"
                        ? "border border-emerald-400/40 text-emerald-300"
                        : "border border-pearl-white/25 text-pearl-white/50"
                    }`}
                  >
                    {status === "joined" ? "Joined" : "Invited"}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-pearl-white/45 leading-relaxed mb-6">
            There is nothing to pay — your team lead covers the team's entry. Once
            their payment is verified, everyone on this roster gets their ticket by
            email.
          </p>

          {viewerToken ? (
            <TeamLeaveButton
              eventId={evId}
              code={code}
              token={viewerToken}
              memberName={me?.name ?? ""}
              teamName={team.name}
            />
          ) : null}
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
