import { NextResponse } from "next/server";
import {
  listAll,
  readPrivate,
  readJsonByPath,
  putJson,
  applicationPath,
  teamPath,
  teamMemberPath,
} from "@/lib/blob-store";
import { Application, feeForApplicant, isLiveApplication } from "@/lib/applications";
import { Team, TeamMember, normalizeTeamCode, memberStatus } from "@/lib/teams";
import { events, eventId as slugFor } from "@/lib/pravrutti-data";
import { newTicketId } from "@/lib/ticket-id";
import { cancelApplication, reinstateApplication, resendConfirmation } from "@/lib/payment-review";
import { buildExternalApplication, EXTERNAL_SOURCES, type ExternalSource } from "@/lib/external-registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finding the people whose money left but whose registration never arrived.
 *
 * Payment happens on the college's JUNO portal, in a tab we do not control and
 * cannot get a callback from. The application row is written only when someone
 * comes back and types their transaction ID, so any break in between — the
 * portal 404ing mid-payment, a closed tab, a lost receipt — takes the money and
 * leaves us nothing.
 *
 * The recovery is that a team outlives the lead's application. Creating a team
 * writes the team and the lead's own member record immediately, while the
 * lead's application is written much later, after payment. A team whose lead
 * has no application is therefore a lead who paid and never made it back, and
 * their name, phone and college are still on their member record — enough to
 * rebuild the row without asking them for anything.
 *
 * This reports rather than repairs. Deciding that money actually arrived is an
 * organiser's call against the college's payment sheet, so a restored row is
 * written as awaiting, never as paid.
 */

function authed(req: Request) {
  const key = req.headers.get("x-admin-key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function readAll<T>(prefix: string): Promise<T[]> {
  const blobs = await listAll(prefix);
  const out: T[] = [];
  const CHUNK = 20;
  for (let i = 0; i < blobs.length; i += CHUNK) {
    const batch = await Promise.all(blobs.slice(i, i + CHUNK).map((b) => readPrivate(b.url)));
    for (const r of batch) if (r) out.push(r as T);
  }
  return out;
}

/* A soft refusal that is about volume, not about the address: the same
   message sent later goes through untouched. Hostinger answers
   `451 4.7.1 Ratelimit "hostinger_out_ratelimit" exceeded`; the other shapes
   are what the common relays say for the same thing. */
const THROTTLED = /ratelimit|rate limit|too many|throttl|4\.7\.1|\b(?:421|450|451)\b/i;

const key = (evId: string, email: string) => `${evId}::${String(email).trim().toLowerCase()}`;

type MemberRecord = { code?: string; eventId?: string; member?: TeamMember };

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [apps, teams, memberRecords] = await Promise.all([
    readAll<Application>("app/"),
    readAll<Team>("team/"),
    readAll<MemberRecord>("team-member/"),
  ]);

  const haveApp = new Set(apps.map((a) => key(a.eventId, a.email)));

  /* A member record rewritten to an empty code is someone who left or was
     removed — not someone missing anything. */
  const liveMembers = memberRecords.filter(
    (r) => r.member?.email && normalizeTeamCode(r.code ?? "") && r.eventId,
  );

  const byTeam = new Map<string, MemberRecord[]>();
  for (const r of liveMembers) {
    const k = `${r.eventId}::${normalizeTeamCode(r.code!)}`;
    byTeam.set(k, [...(byTeam.get(k) ?? []), r]);
  }

  const orphanLeads = teams
    .filter((t) => !t.deletedAt && t.createdByEmail)
    .filter((t) => !haveApp.has(key(t.eventId, t.createdByEmail)))
    .map((t) => {
      const roster = byTeam.get(`${t.eventId}::${normalizeTeamCode(t.code)}`) ?? [];
      const leadRec = roster.find(
        (r) => r.member!.email.toLowerCase() === t.createdByEmail.toLowerCase(),
      );
      const event = events.find((e) => slugFor(e.name) === t.eventId);
      return {
        eventId: t.eventId,
        eventName: event?.name ?? t.eventId,
        code: t.code,
        teamName: t.name,
        createdAt: t.createdAt,
        /* Present unless the lead's own member record is gone too, in which
           case the row has to be rebuilt by hand from the payment sheet. */
        lead: leadRec?.member
          ? {
              name: leadRec.member.name,
              email: leadRec.member.email,
              phone: leadRec.member.phone,
              college: leadRec.member.college,
            }
          : { email: t.createdByEmail, name: null, phone: null, college: null },
        recoverable: Boolean(leadRec?.member),
        teammatesRegistered: roster.filter(
          (r) =>
            r.member!.email.toLowerCase() !== t.createdByEmail.toLowerCase() &&
            haveApp.has(key(t.eventId, r.member!.email)),
        ).length,
        rosterSize: roster.length,
      };
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  /* Accepted teammates with no application of their own. Rarer than a missing
     lead — they owe nothing, so nothing external can interrupt them — but it
     would leave someone off the desk list on the day. */
  const orphanMembers = liveMembers
    .filter((r) => {
      const m = r.member!;
      if (memberStatus(m) !== "joined") return false;
      if (haveApp.has(key(r.eventId!, m.email))) return false;
      const t = teams.find(
        (x) => x.eventId === r.eventId && normalizeTeamCode(x.code) === normalizeTeamCode(r.code!),
      );
      return Boolean(t) && t!.createdByEmail.toLowerCase() !== m.email.toLowerCase();
    })
    .map((r) => ({
      eventId: r.eventId,
      email: r.member!.email,
      name: r.member!.name,
      code: normalizeTeamCode(r.code!),
    }));

  const awaiting = apps
    .filter((a) => a.payment === "awaiting")
    .map((a) => ({
      eventId: a.eventId,
      eventName: a.eventName,
      name: a.name,
      email: a.email,
      paymentRef: (a as any).paymentRef ?? null,
      appliedAt: a.appliedAt,
    }));

  return NextResponse.json({
    summary: {
      applications: apps.length,
      teams: teams.filter((t) => !t.deletedAt).length,
      orphanLeads: orphanLeads.length,
      orphanMembers: orphanMembers.length,
      awaitingVerification: awaiting.length,
    },
    orphanLeads,
    orphanMembers,
    awaiting,
  });
}

/**
 * POST { action: "restore_lead", eventId, code, paymentRef? }
 *
 * Rebuilds the missing application from the team and the lead's member record.
 * Never overwrites an existing row, so running it twice is harmless.
 */
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  /* Discoverize went free after some teams had already registered under the
     old paid flow, leaving them owing a ₹200 nobody should have asked for.
     One-off and idempotent; the shortlisted and the already-paid are skipped
     (lib/discoverize-review). Here rather than on Discoverize's own desk
     because that desk needs a signed-in organiser and this needs the key. */
  if (String(body?.action ?? "") === "discoverize_free") {
    const { migrateToFreeEntry } = await import("@/lib/discoverize-review");
    const out = await migrateToFreeEntry();
    return NextResponse.json({
      ok: true,
      converted: out.converted,
      looked: out.looked,
      rows: out.applications.map((a) => ({ name: a.name, email: a.email, payment: a.payment, fee: a.fee })),
    });
  }

  /**
   * Confirming a team the payment report cannot see.
   *
   * The desk already does this from a signed-in session, and that is where it
   * belongs: `paymentVerifiedBy` exists precisely because a decision about
   * money needs a name against it, and a key shared by the committee supplies
   * none. This exists for the one case the desk cannot reach — the report
   * matches on email, so a student who pays from their college address and
   * registers from a personal one is invisible to every button on it. They
   * are found by phone, by hand, and then there is nothing to press.
   *
   * The guarantee the session gave for free is kept by making it explicit:
   * the caller must name the organiser who decided, and an unnamed
   * confirmation is refused rather than written. verifyTeam does the rest —
   * the whole roster together, the money against the payer alone, and a
   * ticket to each of them.
   */
  if (String(body?.action ?? "") === "verify_team") {
    const evId = String(body?.eventId ?? "").trim();
    const code = normalizeTeamCode(String(body?.code ?? ""));
    const by = String(body?.by ?? "").trim().toLowerCase();
    const rawRef = body?.paymentRef;
    const paymentRef = rawRef === undefined ? undefined : String(rawRef ?? "").trim() || null;

    if (!evId || !code)
      return NextResponse.json({ error: "Missing eventId or code." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(by))
      return NextResponse.json(
        { error: "Say who decided: pass the organiser's email as `by`. The shared key names nobody." },
        { status: 400 },
      );

    const { verifyTeam } = await import("@/lib/payment-review");
    const out = await verifyTeam({ eventId: evId, code, by, paymentRef });
    if (!out) return NextResponse.json({ error: "No live registrations for that team." }, { status: 404 });

    return NextResponse.json({
      ok: true,
      confirmed: out.applications.map((a) => ({
        name: a.name, email: a.email, status: a.status, payment: a.payment,
        paymentRef: a.paymentRef ?? null, verifiedBy: a.paymentVerifiedBy ?? null,
      })),
      mailed: out.mails.filter((m) => m?.sent).length,
    });
  }

  /* Sending the tickets the mail server refused.
   *
   * Confirming someone and telling them are two separate acts, and only the
   * first is guaranteed. Hostinger throttles outbound mail from the fest
   * mailbox, so a run of confirmations comes back "451 Ratelimit exceeded":
   * the rows are confirmed, the students hear nothing, and the only record of
   * it is confirmationEmailError on a row nobody thinks to open. That is how
   * a team ends up messaging us three days later asking why their teammates
   * are still "in review" when the dashboard has said confirmed all along.
   *
   * So the gap is treated as a queue. Everyone confirmed without a ticket
   * email is sent one, longest wait first, with a pause between each so the
   * throttle sees a trickle rather than a burst. A throttled refusal ends the
   * run: the next message would be refused just as fast, and working down the
   * list would only stamp fresh errors on rows that never had a chance. Any
   * other refusal is about that one address, so the queue carries on.
   *
   * Sending is idempotent by construction — a sent ticket stamps
   * confirmationEmailAt, which takes the row out of the queue — so calling
   * this repeatedly until `remaining` reaches zero is the intended use. */
  if (String(body?.action ?? "") === "resend_missing") {
    const dryRun = body?.dryRun === true;
    const limit = Math.min(Math.max(Math.trunc(Number(body?.limit ?? 5)) || 5, 1), 25);
    const rawGap = Math.trunc(Number(body?.gapMs));
    const gapMs = Math.min(Math.max(Number.isFinite(rawGap) ? rawGap : 4000, 0), 30_000);

    const owed = (await readAll<Application>("app/"))
      .filter((a) => a.status === "confirmed" && !a.confirmationEmailAt)
      .sort((a, b) =>
        String(a.decidedAt ?? a.appliedAt).localeCompare(String(b.decidedAt ?? b.appliedAt)),
      );

    if (dryRun)
      return NextResponse.json({
        ok: true,
        dryRun: true,
        owed: owed.length,
        people: owed.map((a) => ({
          name: a.name,
          email: a.email,
          eventId: a.eventId,
          decidedAt: a.decidedAt ?? null,
          lastError: a.confirmationEmailError ?? null,
        })),
      });

    const results: {
      name: string; email: string; eventId: string; sent: boolean; error: string | null;
    }[] = [];
    let stopped: string | null = null;

    for (const a of owed.slice(0, limit)) {
      if (results.length && gapMs) await new Promise((r) => setTimeout(r, gapMs));

      const out = await resendConfirmation({ eventId: a.eventId, email: a.email });
      const mail = out?.mail ?? { sent: false, error: "Application not found." };
      results.push({
        name: a.name, email: a.email, eventId: a.eventId,
        sent: !!mail.sent, error: mail.error ?? null,
      });

      if (!mail.sent && THROTTLED.test(String(mail.error ?? ""))) {
        stopped = "Mail server is throttling — stopped here. Wait, then call again.";
        break;
      }
    }

    const sent = results.filter((r) => r.sent).length;
    return NextResponse.json({
      ok: true, owed: owed.length, attempted: results.length, sent,
      remaining: owed.length - sent, stopped, results,
    });
  }

  /* Correcting the name somebody registered under.
   *
   * Students put jokes in the name field and then want their own name back,
   * because it is the name on the ticket, on the desk list and on whatever
   * is checked at the door. Refusing is not kindness — it leaves a real
   * student holding a ticket that does not look like theirs.
   *
   * The name sits in two records: the application, which the ticket and the
   * desk read, and the team-member record, which the team roster reads.
   * Changing one leaves the other showing the joke.
   *
   * Nothing else moves. Not the status, not the money, and above all not the
   * ticket ID — they may already have a screenshot of it. */
  if (String(body?.action ?? "") === "rename") {
    const evId = String(body?.eventId ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();

    if (!evId || !email)
      return NextResponse.json({ error: "Missing eventId or email." }, { status: 400 });
    if (name.length < 2 || name.length > 80)
      return NextResponse.json({ error: "Enter a full name (2–80 characters)." }, { status: 400 });

    const appPath = applicationPath(evId, email);
    const record = (await readJsonByPath(appPath)) as Application | null;
    if (!record) return NextResponse.json({ error: "No registration for that person." }, { status: 404 });

    const was = record.name;
    await putJson(appPath, { ...record, name }, true);

    /* Solo entrants have no member record, and that is not a failure. */
    const memberKey = teamMemberPath(evId, email);
    const membership = (await readJsonByPath(memberKey)) as MemberRecord | null;
    const onRoster = !!membership?.member;
    if (onRoster)
      await putJson(memberKey, { ...membership, member: { ...membership!.member, name } }, true);

    return NextResponse.json({
      ok: true, eventId: evId, email, was, name, roster: onRoster,
      ticketId: record.ticketId ?? null,
    });
  }

  /* Changing who leads — and pays for — a team.

     The lead is whoever the team record names, and the lead's registration
     is the charged one; changing the lead moves both. The new lead's
     registration becomes the one owing the fee, set up exactly like a lead
     who has not paid yet — so their event page offers "Did your payment go
     through? / Not yet — reopen the portal" — and the old lead's becomes an
     ordinary teammate's, covered by the new lead. Ticket IDs never change.

     It never moves money. If the current lead has paid, quoted a payment ID
     or been confirmed, the fee is recorded against them, and handing the team
     over would leave that payment hanging off a teammate — a refund
     conversation, not a button. Wonderfools is why this exists: their lead
     went to pay on 26 Sep, never did, and the team asked for Darshan to
     take over. */
  if (String(body?.action ?? "") === "set_lead") {
    const evId = String(body?.eventId ?? "").trim();
    const code = normalizeTeamCode(String(body?.code ?? ""));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const by = String(body?.by ?? "").trim().toLowerCase();
    if (!evId || !code || !email)
      return NextResponse.json({ error: "Missing eventId, code or email." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(by))
      return NextResponse.json(
        { error: "Say who decided: pass the organiser's email as `by`. The shared key names nobody." },
        { status: 400 },
      );

    const event = events.find((e) => slugFor(e.name) === evId);
    if (!event) return NextResponse.json({ error: "That event doesn't exist." }, { status: 400 });
    const team = (await readJsonByPath(teamPath(evId, code))) as Team | null;
    if (!team || team.deletedAt)
      return NextResponse.json({ error: "No team found for that code." }, { status: 404 });

    const oldLead = String(team.createdByEmail ?? "").trim().toLowerCase();
    if (oldLead === email)
      return NextResponse.json({ error: "They already lead this team." }, { status: 409 });

    const nextPath = applicationPath(evId, email);
    const next = (await readJsonByPath(nextPath)) as Application | null;
    if (!next || !isLiveApplication(next.status) || normalizeTeamCode(next.teamCode ?? "") !== code)
      return NextResponse.json(
        { error: "They need a live registration on this team first — have them join it with the team code." },
        { status: 409 },
      );

    const prevPath = applicationPath(evId, oldLead);
    const prev = oldLead ? ((await readJsonByPath(prevPath)) as Application | null) : null;
    const prevLive = !!prev && isLiveApplication(prev.status);
    if (prevLive && (prev!.status === "confirmed" || prev!.payment === "paid" || String(prev!.paymentRef ?? "").trim()))
      return NextResponse.json(
        {
          error:
            "The current lead has paid, quoted a payment ID, or been confirmed — the fee is recorded against them. Moving the team would leave that payment on a teammate. Sort the payment out first.",
        },
        { status: 409 },
      );

    const at = new Date().toISOString();
    const free = event.fee.toLowerCase().startsWith("free");
    const lead = feeForApplicant({ eventFree: free, eventFee: event.fee, isJoiner: false });
    const mate = feeForApplicant({ eventFree: free, eventFee: event.fee, isJoiner: true });

    /* The new lead first: if a later write fails, the team still has a lead
       who can pay, rather than a team pointing at nobody who owes the fee. */
    const promoted: Application = {
      ...next,
      payment: lead.payment,
      fee: lead.fee,
      paymentRef: null,
      ...(free ? {} : { stage: "intent" as const }),
    };
    await putJson(nextPath, promoted, true);
    await putJson(
      teamPath(evId, code),
      { ...team, createdByEmail: email, previousLead: oldLead || null, leadChangedBy: by, leadChangedAt: at },
      true,
    );
    if (prevLive) {
      const { stage: _stage, ...rest } = prev!;
      await putJson(prevPath, { ...rest, payment: mate.payment, fee: mate.fee, paymentRef: null }, true);
    }

    return NextResponse.json({
      ok: true,
      team: { code, name: team.name, eventId: evId },
      lead: { email, name: promoted.name, payment: promoted.payment, fee: promoted.fee, ticketId: promoted.ticketId },
      previousLead: prevLive ? { email: oldLead, name: prev!.name, payment: mate.payment } : { email: oldLead || null, registered: false },
    });
  }

  /* Undoing a restore.

     A restored row is a guess — that a team with members around it belonged to
     a lead who had paid. When that turns out to be wrong the row has to go,
     and cancelling is the honest way to remove it: declining would stamp it
     "refunded" and invent a repayment for money that never arrived.

     This deliberately bypasses the guard that stops a lead withdrawing from
     under their team. That guard protects teammates from a lead leaving
     silently; an organiser removing a row they know to be wrong is the case it
     was never meant to catch. */
  /* Taking back a decline once the money is found (lib/payment-review). The
     desk has no button for it — verifying a declined row's money records it
     and nothing more — so it lives here, and like verify_team it names the
     organiser who decided. */
  /* Entries taken on Unstop, imported (lib/external-registrations). Only
     ever adds: someone already registered keeps the row they have, and an
     entry that cannot be read is reported back rather than guessed at. */
  if (body?.action === "import_external") {
    const evId = String(body?.eventId ?? "").trim();
    const by = String(body?.by ?? "").trim().toLowerCase();
    const source = String(body?.source ?? "") as ExternalSource;
    const entries: unknown[] = Array.isArray(body?.entries) ? body.entries.slice(0, 200) : [];
    if (!(EXTERNAL_SOURCES as readonly string[]).includes(source))
      return NextResponse.json({ error: `Unknown source. Known: ${EXTERNAL_SOURCES.join(", ")}.` }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(by))
      return NextResponse.json(
        { error: "Say who decided: pass the organiser's email as `by`. The shared key names nobody." },
        { status: 400 },
      );
    if (entries.length === 0) return NextResponse.json({ error: "No entries." }, { status: 400 });
    const event = events.find((e) => slugFor(e.name) === evId);
    if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

    const at = new Date().toISOString();
    const free = event.fee.toLowerCase().startsWith("free");
    const imported: { email: string; name: string; ticketId: string; mailed: boolean }[] = [];
    const skipped: { email: string; reason: string }[] = [];
    for (const entry of entries) {
      const built = buildExternalApplication({
        entry: (entry ?? {}) as Record<string, string>, source, by, at,
        event: { id: evId, name: event.name, fee: event.fee, free },
      });
      const email = String((entry as { email?: string })?.email ?? "").trim().toLowerCase();
      if ("error" in built) { skipped.push({ email, reason: built.error }); continue; }
      const app = built.application;
      try {
        await putJson(applicationPath(evId, app.email), app, false);
      } catch {
        skipped.push({ email: app.email, reason: "Already registered for this event — left as it is." });
        continue;
      }
      const sent = await resendConfirmation({ eventId: evId, email: app.email });
      imported.push({ email: app.email, name: app.name, ticketId: app.ticketId, mailed: !!sent?.mail?.sent });
    }
    return NextResponse.json({ ok: true, imported, skipped });
  }

  if (body?.action === "reinstate") {
    const evId = String(body?.eventId ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const by = String(body?.by ?? "").trim().toLowerCase();
    const paymentRef = String(body?.paymentRef ?? "").trim() || null;
    if (!evId || !email)
      return NextResponse.json({ error: "Missing eventId or email." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(by))
      return NextResponse.json(
        { error: "Say who decided: pass the organiser's email as `by`. The shared key names nobody." },
        { status: 400 },
      );

    const result = await reinstateApplication({ eventId: evId, email, by, paymentRef });
    if ("refused" in result) {
      const why = {
        missing: ["No such application.", 404],
        not_declined: ["Only a declined registration can be reinstated.", 409],
        not_paid: ["Its money isn't verified as held — a refunded or unverified fee is a conversation, not a button.", 409],
      } as const;
      const [error, status] = why[result.refused];
      return NextResponse.json({ error }, { status });
    }
    const a = result.outcome.application;
    return NextResponse.json({
      ok: true,
      status: a.status, payment: a.payment, paymentRef: a.paymentRef ?? null,
      reinstatedBy: a.reinstatedBy, mailed: !!result.outcome.mail?.sent,
      mailError: a.confirmationEmailError ?? null,
    });
  }

  if (body?.action === "cancel") {
    const evId = String(body?.eventId ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!evId || !email)
      return NextResponse.json({ error: "Missing eventId or email." }, { status: 400 });

    const outcome = await cancelApplication({ eventId: evId, email });
    if (!outcome) return NextResponse.json({ error: "No such application." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      status: outcome.application.status,
      payment: outcome.application.payment,
      refundedAt: outcome.application.refundedAt ?? null,
    });
  }

  if (body?.action !== "restore_lead")
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const evId = String(body?.eventId ?? "").trim();
  const code = normalizeTeamCode(String(body?.code ?? ""));
  const paymentRef = String(body?.paymentRef ?? "").trim();
  if (!evId || !code)
    return NextResponse.json({ error: "Missing eventId or code." }, { status: 400 });

  const event = events.find((e) => slugFor(e.name) === evId);
  if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  const team = (await readJsonByPath(teamPath(evId, code))) as Team | null;
  if (!team || team.deletedAt)
    return NextResponse.json({ error: "No such team." }, { status: 404 });

  const email = String(team.createdByEmail).trim().toLowerCase();
  const existing = await readJsonByPath(applicationPath(evId, email));
  if (existing)
    return NextResponse.json({ error: "That lead already has an application." }, { status: 409 });

  const rec = (await readJsonByPath(teamMemberPath(evId, email))) as MemberRecord | null;
  const lead = rec?.member;
  if (!lead)
    return NextResponse.json(
      { error: "The lead's member record is gone — rebuild this row by hand." },
      { status: 422 },
    );

  const { fee } = feeForApplicant({
    eventFree: event.fee.toLowerCase().startsWith("free"),
    eventFee: event.fee,
    isJoiner: false,
  });

  const app: Application = {
    ticketId: newTicketId(),
    eventId: evId,
    eventName: event.name,
    status: "pending",
    /* Awaiting, never paid: an organiser confirms the money against the
       college's sheet, and that decision records who made it. */
    payment: "awaiting",
    fee,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    college: lead.college,
    teamName: team.name,
    teamCode: team.code,
    members: null,
    appliedAt: team.createdAt,
    ...(paymentRef ? { paymentRef } : {}),
  } as Application;

  await putJson(applicationPath(evId, email), app, false);
  return NextResponse.json({ ok: true, restored: app });
}
