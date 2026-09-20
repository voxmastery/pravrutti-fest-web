import { listAll, readPrivate, putJson, applicationPath } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";
import { sendReferenceReminder } from "@/lib/reference-reminder-email";

/**
 * One pass over every registration: who owes us a Transaction Reference No,
 * who is due a reminder about it, and — unless it is a dry run — sending it.
 *
 * Safe to run as often as you like. A person is reminded at most once in
 * twenty hours and at most three times ever, both recorded on their row, so
 * an hourly scheduler and an organiser pressing the button by hand cannot
 * between them nag anybody. Nobody is reminded who has a reference, whose
 * payment is verified, or who withdrew.
 */

export const MIN_GAP_HOURS = 20;
export const MAX_REMINDERS = 3;

export type ReminderRun = {
  sent: number;
  skipped: number;
  failed: { eventId: string; email: string; error: string }[];
  due: { eventId: string; email: string; unanswered: boolean }[];
  dryRun: boolean;
};

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

/** Pending, owes a payment, and has given us nothing to match it with. */
export function owesReference(a: Application): boolean {
  return a.status === "pending" && a.payment === "awaiting" && !a.paymentRef;
}

/** Reminded recently, or reminded enough. */
export function throttled(a: Application, now = Date.now()): boolean {
  if ((a.referenceReminderCount ?? 0) >= MAX_REMINDERS) return true;
  if (!a.referenceReminderAt) return false;
  const last = Date.parse(a.referenceReminderAt);
  return Number.isFinite(last) && now - last < MIN_GAP_HOURS * 3600e3;
}

export async function runReferenceReminders(opts: { dryRun?: boolean } = {}): Promise<ReminderRun> {
  const dryRun = opts.dryRun === true;
  const all = await readAll<Application>("app/");
  const candidates = all.filter(owesReference);
  const due = candidates.filter((a) => !throttled(a));
  const skipped = candidates.length - due.length;
  const summary = due.map((a) => ({ eventId: a.eventId, email: a.email, unanswered: a.stage === "intent" }));
  if (dryRun) return { sent: 0, skipped, failed: [], due: summary, dryRun: true };

  let sent = 0;
  const failed: ReminderRun["failed"] = [];
  for (const a of due) {
    const r = await sendReferenceReminder(a);
    if (!r.sent) {
      failed.push({ eventId: a.eventId, email: a.email, error: r.error ?? "Mail send failed." });
      continue;
    }
    sent += 1;
    try {
      await putJson(
        applicationPath(a.eventId, a.email),
        { ...a, referenceReminderAt: new Date().toISOString(), referenceReminderCount: (a.referenceReminderCount ?? 0) + 1 },
        true,
      );
    } catch (e) {
      /* The mail went; losing the stamp only risks one extra reminder. */
      console.error("reminder stamp failed", a.eventId, a.email, e);
    }
  }
  return { sent, skipped, failed, due: summary, dryRun: false };
}
