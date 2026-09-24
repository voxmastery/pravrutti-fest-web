import "server-only";
import {
  applicationPath,
  deleteJson,
  emailScopedKey,
  gatePath,
  invitePath,
  listAll,
  listTeamMembers,
  paymentRefPath,
  putJson,
  readJsonByPath,
  readPrivate,
  teamMemberPath,
} from "@/lib/blob-store";
import { events, eventId } from "@/lib/pravrutti-data";
import type { Application } from "@/lib/applications";
import type { Team, TeamMember } from "@/lib/teams";

/**
 * Removing test and demo accounts from the live data.
 *
 * Organisers registered with their own addresses to walk the flow, and those
 * rows now sit in every count and list. Cancelling would not do: it stamps a
 * paid row "refunded", which invents a refund that the books then show as
 * owed. So this deletes — everything keyed on the address, across every event.
 *
 * Two guards, because a delete cannot be taken back by the app:
 *
 *   1. Plan, then confirm. The same plan is recomputed on confirm, so what is
 *      deleted is what the store holds at that moment, never what a stale
 *      preview listed.
 *   2. A copy first. Every record is written to admin/purge-log/ before its
 *      delete, so anything removed by mistake can be put back by hand.
 *
 * A team led by a test account but joined by anyone who is NOT being removed
 * blocks the whole run: deleting its lead would strand real people on a team
 * with no lead and no paid registration.
 */

export type PurgeKind = "registration" | "team" | "team-membership" | "payment-ref" | "invite" | "gate" | "reminder";

export type PurgeItem = { path: string; kind: PurgeKind; email: string; label: string };

export type PurgePlan = {
  emails: string[];
  items: PurgeItem[];
  /** Why the run is refused. Empty means it may go ahead. */
  blockers: string[];
  /** Addresses with nothing stored against them — usually a typo. */
  notFound: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** listAll hands back "sql://path", "mem:path" or "devfs:path"; the store key is the path. */
const storePath = (url: string) => url.replace(/^(sql:\/\/|mem:|devfs:)/, "");

export function parseEmails(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(/[\s,;]+/);
  return [...new Set(list.map(norm).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)))];
}

export async function planPurge(emailsIn: string[]): Promise<PurgePlan> {
  const emails = [...new Set(emailsIn.map(norm))];
  const purging = new Set(emails);
  const items: PurgeItem[] = [];
  const blockers: string[] = [];
  const add = (item: PurgeItem) => {
    if (!items.some((i) => i.path === item.path)) items.push(item);
  };

  const names = new Map(events.map((e) => [eventId(e.name), e.name]));
  const evIds = [...names.keys()];

  for (const email of emails) {
    for (const ev of evIds) {
      const evName = names.get(ev) ?? ev;

      const app = (await readJsonByPath(applicationPath(ev, email))) as Application | null;
      if (app) {
        add({ path: applicationPath(ev, email), kind: "registration", email, label: `${evName}: registration (${app.status})` });
        if (app.paymentRef) {
          const refPath = paymentRefPath(app.paymentRef);
          const owner = (await readJsonByPath(refPath)) as { email?: string; eventId?: string } | null;
          if (owner && norm(owner.email ?? "") === email)
            add({ path: refPath, kind: "payment-ref", email, label: `${evName}: transaction ID claim` });
        }
      }

      const rec = (await readJsonByPath(teamMemberPath(ev, email))) as { member?: TeamMember } | null;
      if (rec) {
        add({ path: teamMemberPath(ev, email), kind: "team-membership", email, label: `${evName}: team membership` });
        if (rec.member?.inviteToken)
          add({ path: invitePath(rec.member.inviteToken), kind: "invite", email, label: `${evName}: pending invite` });
      }

      for (const r of await listAll(`reminder/${emailScopedKey(ev, email)}/`))
        add({ path: storePath(r.url), kind: "reminder", email, label: `${evName}: reminder record` });
    }

    if (await readJsonByPath(gatePath(email)))
      add({ path: gatePath(email), kind: "gate", email, label: "Fest entry check-in" });
  }

  // Teams the test accounts lead.
  for (const row of await listAll("team/")) {
    const team = (await readPrivate(row.url)) as Team | null;
    if (!team?.code || !purging.has(norm(team.createdByEmail ?? ""))) continue;
    const evName = names.get(team.eventId) ?? team.eventId;
    const others = ((await listTeamMembers(team.eventId, team.code)) as TeamMember[])
      .map((m) => norm(m.email))
      .filter((e) => e && !purging.has(e));
    if (others.length && !team.deletedAt && !team.movedTo) {
      blockers.push(
        `${evName}: team "${team.name}" is led by ${norm(team.createdByEmail)} but also has ${others.join(", ")}. ` +
          `Add ${others.length === 1 ? "that address" : "those addresses"} to the list if they are test accounts too, or leave this lead in place.`
      );
      continue;
    }
    add({ path: `team/${team.eventId}/${team.code}.json`, kind: "team", email: norm(team.createdByEmail), label: `${evName}: team "${team.name}"` });
  }

  const found = new Set(items.map((i) => i.email));
  return { emails, items, blockers, notFound: emails.filter((e) => !found.has(e)) };
}

/** Deletes a plan's records after saving a copy of each. Returns the log path. */
export async function executePurge(plan: PurgePlan, by: string): Promise<{ deleted: number; log: string }> {
  const records = await Promise.all(plan.items.map(async (i) => ({ ...i, data: await readJsonByPath(i.path) })));
  const at = new Date().toISOString();
  const log = `admin/purge-log/${at.replace(/[:.]/g, "-")}.json`;
  // The copy must land before anything is deleted; if it fails, nothing is.
  await putJson(log, { by, at, emails: plan.emails, records }, false);
  let deleted = 0;
  for (const r of records) {
    if (r.data == null) continue;
    await deleteJson(r.path);
    deleted++;
  }
  return { deleted, log };
}
