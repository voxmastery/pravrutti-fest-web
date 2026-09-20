import { describe, it, expect, vi, afterEach } from "vitest";
import { withinSendingHours, startReminderScheduler } from "@/lib/reference-reminder-scheduler";

/* The app reminds people itself, on a timer in the one Node process that
   serves pravrutti.tech. Indian daytime only. */

const at = (utc: string) => new Date(utc);

describe("withinSendingHours", () => {
  it("is Indian daytime, 08:00 to 21:00 IST", () => {
    expect(withinSendingHours(at("2026-09-20T02:30:00Z"))).toBe(true); // 08:00 IST
    expect(withinSendingHours(at("2026-09-20T09:00:00Z"))).toBe(true); // 14:30 IST
    expect(withinSendingHours(at("2026-09-20T15:29:00Z"))).toBe(true); // 20:59 IST
    expect(withinSendingHours(at("2026-09-20T15:30:00Z"))).toBe(false); // 21:00 IST
    expect(withinSendingHours(at("2026-09-20T21:30:00Z"))).toBe(false); // 03:00 IST
    expect(withinSendingHours(at("2026-09-20T02:29:00Z"))).toBe(false); // 07:59 IST
  });
});

describe("startReminderScheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("runs the pass after the initial delay and then every interval, only in sending hours", async () => {
    vi.useFakeTimers();
    let clock = at("2026-09-20T05:00:00Z"); // 10:30 IST
    const run = vi.fn(async () => ({ sent: 1, skipped: 0, failed: [] }));
    const lines: string[] = [];
    const stop = startReminderScheduler({ run, intervalMs: 1000, initialDelayMs: 100, now: () => clock, log: (l) => lines.push(l) });

    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(lines[0]).toBe("[reminders] sent=1 skipped=0 failed=0");

    clock = at("2026-09-20T20:00:00Z"); // 01:30 IST — quiet
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(2);

    stop();
    clock = at("2026-09-20T05:00:00Z");
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("a failing pass is logged, not thrown, and the next tick still runs", async () => {
    vi.useFakeTimers();
    const run = vi.fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({ sent: 0, skipped: 0, failed: [] });
    const lines: string[] = [];
    const stop = startReminderScheduler({ run, intervalMs: 1000, initialDelayMs: 10, now: () => at("2026-09-20T05:00:00Z"), log: (l) => lines.push(l) });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(lines[0]).toMatch(/pass failed: db down/);
    stop();
  });
});
