import { TEST_SITE } from "@/lib/test-site";
import { mailerConfigured } from "@/lib/mailer";

/**
 * The app reminding people itself.
 *
 * pravrutti.tech is one long-lived Node process on Hostinger, so a timer in
 * it is the simplest scheduler there is: nothing to configure on the host,
 * no key to keep anywhere, and it ships with the app. The pass it runs is
 * throttled per person (lib/reference-reminders), so firing it hourly costs
 * nothing — the timer only decides *when* someone due gets theirs.
 *
 * Sending hours are Indian time, because the readers are students in
 * Bengaluru and a reminder at 03:00 is the wrong kind of memorable.
 */

export const SENDING_HOURS_IST: [number, number] = [8, 21];
const IST_OFFSET_MIN = 330;

export function withinSendingHours(date = new Date()): boolean {
  const istMinutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  const hour = istMinutes / 60;
  const [from, to] = SENDING_HOURS_IST;
  return hour >= from && hour < to;
}

/** Off on the Vercel test site (no real people, no database) and anywhere
    mail is not configured; REMINDERS_DISABLED=1 is the manual off switch. */
export function schedulerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (TEST_SITE) return false;
  if (env.REMINDERS_DISABLED === "1") return false;
  return mailerConfigured();
}

type Tick = () => Promise<{ sent: number; skipped: number; failed: unknown[] }>;

export function startReminderScheduler(opts: {
  run: Tick;
  intervalMs?: number;
  initialDelayMs?: number;
  now?: () => Date;
  log?: (line: string) => void;
}): () => void {
  const intervalMs = opts.intervalMs ?? 60 * 60e3;
  const initialDelayMs = opts.initialDelayMs ?? 2 * 60e3;
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? ((l) => console.log(l));
  let running = false;

  const tick = async () => {
    if (running) return;
    if (!withinSendingHours(now())) return;
    running = true;
    try {
      const r = await opts.run();
      log(`[reminders] sent=${r.sent} skipped=${r.skipped} failed=${r.failed.length}`);
    } catch (e) {
      log(`[reminders] pass failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, initialDelayMs);
  const every = setInterval(tick, intervalMs);
  /* Never keep the process alive just for this. */
  first.unref?.();
  every.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
