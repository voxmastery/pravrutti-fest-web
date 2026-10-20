"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { CERTIFICATE_QUESTIONS, answerLabel } from "@/lib/certificate-questions";

type Row = {
  email: string;
  name: string;
  submittedAt: string;
  answers: Record<string, string>;
};

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export default function CertificateFeedbackPage() {
  const dash = useDashboardRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = dash.role === "organiser" || dash.role === "coordinator";

  useEffect(() => {
    if (!dash.ready || !allowed) return;
    fetch("/api/dashboard/certificate-feedback")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load feedback.");
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch((err: Error) => setError(err.message));
  }, [dash.ready, allowed]);

  if (!dash.ready) {
    return (
      <DashboardShell title="Certificate feedback" wide>
        <ListSkeleton rows={6} />
      </DashboardShell>
    );
  }

  if (!allowed) {
    return (
      <DashboardShell title="Certificate feedback">
        <Notice title="No dashboard access">Certificate feedback is for organisers and coordinators.</Notice>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Certificate feedback" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          {rows ? `${rows.length} response${rows.length === 1 ? "" : "s"}` : "Loading responses"} from participants who generated a certificate.
        </p>
        <a
          href="/api/dashboard/certificate-feedback?format=csv"
          className="inline-flex h-[34px] items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white/80 hover:bg-white/[0.08] hover:text-white"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>

      {error && (
        <Notice title="Couldn't load feedback" tone="danger">
          {error}
        </Notice>
      )}

      {!error && rows === null && <ListSkeleton rows={6} />}

      {rows && rows.length === 0 && (
        <Notice title="No responses yet">They appear here after a checked-in participant submits the form.</Notice>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-white/45">
              <tr>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Submitted</th>
                {CERTIFICATE_QUESTIONS.map((question) => (
                  <th key={question.id} className="px-3 py-3 font-medium" title={question.prompt}>
                    {question.column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email} className="border-b border-white/[0.06] align-top last:border-0">
                  <td className="px-3 py-3 font-medium text-white">{row.name}</td>
                  <td className="px-3 py-3 text-white/60">{row.email}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-white/60">{when(row.submittedAt)}</td>
                  {CERTIFICATE_QUESTIONS.map((question) => (
                    <td key={question.id} className="max-w-[240px] px-3 py-3 text-white/80">
                      <span className="line-clamp-4 whitespace-pre-wrap break-words">
                        {row.answers?.[question.id] ? answerLabel(question.id, row.answers[question.id]) : "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
