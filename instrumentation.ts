/**
 * Runs once when the server starts. The only thing that lives here is the
 * reminder scheduler, and only in the Node runtime — the edge runtime has no
 * timers worth trusting and no mailer.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as typeof globalThis & { __pravruttiReminders?: boolean };
  if (g.__pravruttiReminders) return;
  const { schedulerEnabled, startReminderScheduler } = await import("@/lib/reference-reminder-scheduler");
  if (!schedulerEnabled()) return;
  const { runReferenceReminders } = await import("@/lib/reference-reminders");
  g.__pravruttiReminders = true;
  startReminderScheduler({ run: () => runReferenceReminders() });
  console.log("[reminders] scheduler started");
}
