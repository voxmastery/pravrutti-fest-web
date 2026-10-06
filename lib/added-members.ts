import "server-only";
import { feeForApplicant, isLiveApplication, type Application } from "@/lib/applications";
import { applicationPath, listAll, putJson, readJsonByPath, readPrivate, teamMemberPath, teamPath } from "@/lib/blob-store";
import { acceptedMember } from "@/lib/invites";
import { leadIsConfirmed } from "@/lib/lead-decision";
import { events, eventId as slugFor, type Event } from "@/lib/pravrutti-data";
import type { Team, TeamMember } from "@/lib/teams";
import { newTicketId } from "@/lib/ticket-id";

/**
 * A teammate's own registration: covered by the lead's fee, confirmed if the
 * team already is. The same row whichever way they arrived — typing the code,
 * following an invite, or (since 6 Oct 2026) simply being added by their lead.
 */
export function teammateApplication(args: {
  event: Event;
  evId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  team: Team;
  /* An approved team brings its newest member in with it — see
     lib/lead-decision. */
  confirmed: boolean;
}): Application {
  const { payment, fee } = feeForApplicant({
    eventFree: args.event.fee.toLowerCase().startsWith("free"),
    eventFee: args.event.fee,
    isJoiner: true,
  });
  const now = new Date().toISOString();
  return {
    ticketId: newTicketId(),
    eventId: args.evId,
    eventName: args.event.name,
    status: args.confirmed ? "confirmed" : "pending",
    payment,
    fee,
    name: args.name,
    email: args.email,
    phone: args.phone,
    college: args.college,
    teamName: args.team.name,
    teamCode: args.team.code,
    members: null,
    appliedAt: now,
    ...(args.confirmed ? { decidedAt: now } : {}),
  };
}

type MemberRecord = { code?: string; eventId?: string; member?: TeamMember };

/**
 * Registering the teammates leads added before added meant joined.
 *
 * Until 6 Oct 2026 an added teammate had no registration until they followed
 * their invite, and most invites never arrived through a mailbox at its
 * sending limit — 379 sat as "Invite not accepted", 169 on confirmed teams.
 * This does for them what adding a teammate now does: a registration covered
 * by the lead, confirmed if the team is, and the roster entry marked joined.
 * No email — the ticket queue sends tickets once mail can carry them.
 *
 * Left alone: anyone who already has a registration at the event (live or
 * withdrawn — that history is theirs), anyone removed from the team or on a
 * team that was deleted or moved, and anyone already accepted. Safe to run
 * again: a second run finds nobody left to add.
 */
export async function registerAddedMembers(opts: { dryRun: boolean }) {
  const blobs = await listAll("team-member/");
  const records = (await Promise.all(blobs.map((b) => readPrivate(b.url)))) as (MemberRecord | null)[];
  const added: { eventId: string; email: string; name: string; status: Application["status"]; team: string }[] = [];
  const skipped: { eventId: string; email: string; reason: string }[] = [];
  const teams = new Map<string, Team | null>();

  for (const rec of records) {
    const m = rec?.member;
    const evId = String(rec?.eventId ?? "").trim();
    const code = String(rec?.code ?? "").trim().toUpperCase();
    if (!m?.email || !m.invitedAt || m.acceptedAt || !code || !evId) continue;
    const email = m.email.trim().toLowerCase();

    const event = events.find((e) => slugFor(e.name) === evId);
    if (!event) continue;
    const key = `${evId}|${code}`;
    if (!teams.has(key)) teams.set(key, (await readJsonByPath(teamPath(evId, code))) as Team | null);
    const team = teams.get(key);
    if (!team || team.deletedAt || team.movedTo) continue;

    const existing = (await readJsonByPath(applicationPath(evId, email))) as Application | null;
    if (existing) {
      skipped.push({
        eventId: evId, email,
        reason: isLiveApplication(existing.status)
          ? "Already registered for this event."
          : "Has a withdrawn registration for this event — left as it is.",
      });
      continue;
    }

    const confirmed = await leadIsConfirmed(evId, team);
    added.push({ eventId: evId, email, name: m.name, status: confirmed ? "confirmed" : "pending", team: team.name });
    if (opts.dryRun) continue;

    await putJson(
      applicationPath(evId, email),
      {
        ...teammateApplication({
          event, evId, name: m.name, email, phone: m.phone ?? "", college: m.college ?? "", team, confirmed,
        }),
        addedByLead: true,
      },
      false,
    );
    await putJson(teamMemberPath(evId, email), { ...rec, member: acceptedMember(m) }, true);
  }
  return { added, skipped };
}
