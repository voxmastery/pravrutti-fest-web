"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ConfirmAction } from "@/components/dashboard/confirm-action";
import { ArrowLeft, Check, FileSpreadsheet, Loader2, Upload } from "lucide-react";

/**
 * Approving everybody the college's payment report pays for, in one pass.
 *
 * The report is the only record that money actually arrived, and it used to be
 * read by eye against seventy rows on the desk. Here it is read once: upload,
 * look at what it would do, then confirm.
 *
 * Deliberately two steps. The upload writes nothing — it draws a plan, with
 * the payments that match nobody and the registrations the sheet does not
 * cover shown next to the ones it will confirm. Only the button after that
 * writes, and it goes in small batches so a long run shows progress instead
 * of hanging on one request.
 */

type Planned = {
  eventId: string; eventName: string; email: string; name: string;
  ticketId: string; teamCode: string | null; teamSize: number; transaction: string | null;
  appliedAt: string; paidAt: string | null;
};
type Plan = {
  payments: number;
  approve: Planned[];
  unmatched: { name: string; email: string; transaction: string }[];
  unpaid: { eventId: string; eventName: string; email: string; name: string }[];
  alreadyConfirmed: number;
  short: { email: string; payments: number; inReview: number }[];
};

const BATCH = 8;

/** Both clocks in the reader's own, so a pairing can be eyeballed. */
const shortTime = (raw: string | null) => {
  if (!raw) return "—";
  const naive = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  const d = naive
    ? new Date(Date.UTC(+naive[1], +naive[2] - 1, +naive[3], +naive[4], +naive[5]) - 5.5 * 3600e3)
    : new Date(raw);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export default function BulkApprovePage() {
  const dash = useDashboardRole();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ confirmed: number; mailed: number; failed: { email: string; error: string }[] } | null>(null);

  const readFile = useCallback(async (file: File) => {
    setReading(true); setError(null); setPlan(null); setResult(null); setFileName(file.name);
    try {
      /* Parsed in the browser so the roll of payments never has to be posted
         anywhere it is not needed; the server matches on what it already has. */
      const XLSX = await import("xlsx");
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });

      const res = await fetch("/api/dashboard/payment-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "That sheet didn't read.");
      setPlan(body as Plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file didn't read as a spreadsheet.");
    } finally {
      setReading(false);
    }
  }, []);

  const approveAll = async () => {
    if (!plan) return;
    const items = plan.approve.map((a) => ({ eventId: a.eventId, email: a.email, transaction: a.transaction }));
    setProgress({ done: 0, total: items.length });
    setError(null);
    let confirmed = 0, mailed = 0;
    const failed: { email: string; error: string }[] = [];

    for (let i = 0; i < items.length; i += BATCH) {
      const slice = items.slice(i, i + BATCH);
      try {
        const res = await fetch("/api/dashboard/payment-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", items: slice }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "That batch didn't go through.");
        for (const d of body.done ?? []) { confirmed += d.confirmed; mailed += d.mailed; }
        for (const f of body.failed ?? []) failed.push({ email: f.email, error: f.error });
      } catch (e) {
        for (const s of slice) failed.push({ email: s.email, error: e instanceof Error ? e.message : "Failed." });
      }
      setProgress({ done: Math.min(i + BATCH, items.length), total: items.length });
    }

    setProgress(null);
    setResult({ confirmed, mailed, failed });
    setPlan(null);
  };

  return (
    <DashboardShell
      wide
      title="Approve from the payment report"
      eyebrow={
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Fest control
        </Link>
      }
    >
      {!dash.ready ? (
        <ListSkeleton rows={3} />
      ) : dash.role !== "organiser" ? (
        <Notice title="Organisers only" tone="warning">
          Confirming places and sending tickets is an organiser&apos;s decision.
        </Notice>
      ) : (
        <>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-white/50">
            Upload the college&apos;s payment report and this matches it against everyone in review,
            by email. Nothing is written until you press confirm — you see who would be approved,
            which payments match nobody, and who is still waiting.
          </p>

          <Card className="mb-5 rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 p-5 shadow-none">
            <input
              ref={fileInput}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => fileInput.current?.click()}
                disabled={reading || progress !== null}
                className="h-11 rounded-xl bg-cyber-pink px-4 text-sm font-semibold text-white hover:bg-electric-magenta"
              >
                {reading ? <Loader2 className="mr-2 animate-spin" /> : <Upload className="mr-2" />}
                {reading ? "Reading…" : "Choose payment report"}
              </Button>
              <span className="inline-flex items-center gap-2 text-xs text-white/40">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fileName ?? "StudentReport….xls from the college portal"}
              </span>
            </div>
          </Card>

          {error && <Notice title="That didn't read" tone="danger">{error}</Notice>}

          {progress && (
            <Notice title="Approving" tone="neutral">
              {progress.done} of {progress.total} done — leave this page open until it finishes.
            </Notice>
          )}

          {result && (
            <Notice title="Done" tone={result.failed.length ? "warning" : "neutral"}>
              {result.confirmed} {result.confirmed === 1 ? "person" : "people"} confirmed,{" "}
              {result.mailed} {result.mailed === 1 ? "ticket" : "tickets"} emailed.
              {result.failed.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-white/60">
                  {result.failed.map((f, i) => (
                    <li key={i}>{f.email} — {f.error}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          {plan && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Payments in sheet" value={plan.payments} />
                <StatTile label="Will be approved" value={plan.approve.length} />
                <StatTile label="Payments unmatched" value={plan.unmatched.length} />
                <StatTile label="Still waiting" value={plan.unpaid.length} />
              </div>

              {plan.short.length > 0 && (
                <Notice title="More registrations than payments" tone="warning">
                  {plan.short.map((s) => (
                    <p key={s.email}>
                      {s.email} — {s.payments} {s.payments === 1 ? "payment" : "payments"} against{" "}
                      {s.inReview} in review. The earliest {s.payments} will be approved; the rest stay for you.
                    </p>
                  ))}
                </Notice>
              )}

              <Card className="mb-5 gap-0 overflow-hidden rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 py-0 shadow-none">
                <div className="flex items-center justify-between gap-3 border-b border-royal-wine/60 bg-white/[0.04] px-4 py-2.5">
                  <span className="font-display text-xs font-black uppercase tracking-widest text-champagne-gold">
                    To approve
                  </span>
                  <span className="text-xs tabular-nums text-white/40">{plan.approve.length}</span>
                </div>
                {plan.approve.length === 0 ? (
                  <p className="p-6 text-center text-sm text-white/40">
                    Nothing in this sheet matches a registration in review.
                  </p>
                ) : (
                  <div className="max-h-[22rem] divide-y divide-royal-wine/40 overflow-y-auto">
                    {plan.approve.map((a) => (
                      <div key={`${a.eventId}:${a.email}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-champagne-gold">{a.name}</span>
                          <span className="block truncate text-xs text-white/40">{a.email}</span>
                        </span>
                        <span className="w-40 shrink-0 truncate text-xs text-white/70">{a.eventName}</span>
                        {a.teamSize > 1 && (
                          <span className="rounded-full border border-royal-wine bg-midnight-navy px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                            team of {a.teamSize}
                          </span>
                        )}
                        <span className="w-36 shrink-0 truncate text-[11px] tracking-wider text-white/30">
                          {a.transaction ?? "ref already on file"}
                        </span>
                        {/* The report names no event, so the pairing is by
                            clock — show it rather than ask for trust. */}
                        <span className="w-full shrink-0 text-[11px] text-white/25 sm:w-auto">
                          registered {shortTime(a.appliedAt)}
                          {a.paidAt ? ` · paid ${shortTime(a.paidAt)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {plan.approve.length > 0 && (
                <ConfirmAction
                  title={`Approve ${plan.approve.length} ${plan.approve.length === 1 ? "registration" : "registrations"}?`}
                  description={
                    `Every one of them is confirmed and emailed their ticket and QR, teammates included. ` +
                    `The reference from the report is recorded against whoever paid. This cannot be undone in bulk.`
                  }
                  confirmLabel="Approve them"
                  onConfirm={approveAll}
                >
                  <Button
                    disabled={progress !== null}
                    className="h-12 w-full rounded-xl bg-champagne-gold/90 font-display text-xs font-black uppercase tracking-widest text-midnight-navy hover:bg-champagne-gold"
                  >
                    <Check className="mr-2" /> Approve {plan.approve.length} and email tickets
                  </Button>
                </ConfirmAction>
              )}

              {plan.unmatched.length > 0 && (
                <Card className="mt-5 gap-0 overflow-hidden rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 py-0 shadow-none">
                  <div className="border-b border-royal-wine/60 bg-white/[0.04] px-4 py-2.5">
                    <span className="font-display text-xs font-black uppercase tracking-widest text-white/55">
                      Paid, but no registration in review
                    </span>
                  </div>
                  <div className="max-h-56 divide-y divide-royal-wine/40 overflow-y-auto">
                    {plan.unmatched.map((u) => (
                      <div key={u.email} className="px-4 py-2 text-xs">
                        <span className="text-white/70">{u.name || u.email}</span>
                        <span className="text-white/35"> · {u.email} · {u.transaction}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}
