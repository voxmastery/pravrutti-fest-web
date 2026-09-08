"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { readPaymentRef, type Application, type AppStatus } from "@/lib/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { StatTile } from "@/components/dashboard/stat-tile";
import { FilterGroup } from "@/components/dashboard/filter-group";
import { AppStatusBadge, PayStatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmAction } from "@/components/dashboard/confirm-action";
import { Hint } from "@/components/dashboard/hint";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Loader2,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type Feed = {
  mailConfigured: boolean;
  totals: {
    all: number;
    pending: number;
    confirmed: number;
    declined: number;
    awaitingPayment: number;
    paid: number;
    emailed: number;
  };
  events: { eventId: string; name: string }[];
  applications: Application[];
};

type StatusFilter = "all" | AppStatus | "awaiting_payment";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "In review" },
  { id: "awaiting_payment", label: "Payment due" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
];

const key = (a: Application) => `${a.eventId}:${a.email}`;

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

/** Members are stored as JSON now and as a comma-joined string on older rows. */
function readMembers(members: string | null | undefined): string[] {
  if (!members) return [];
  try {
    const parsed = JSON.parse(members);
    if (Array.isArray(parsed))
      return parsed
        .map((m: { name?: string; phone?: string }) => [m.name, m.phone].filter(Boolean).join(" · "))
        .filter(Boolean);
  } catch {
    return members.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function ApplicationsDeskPage() {
  const me = useIdentity();
  const dash = useDashboardRole();

  const [feed, setFeed] = useState<Feed | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [query, setQuery] = useState("");
  const [event, setEvent] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/dashboard/applications");
      if (!res.ok) throw new Error(String(res.status));
      setFeed(await res.json());
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (dash.ready && dash.role === "organiser") load();
  }, [dash.ready, dash.role, load]);

  /** One row changed — patch it in place so filters and scroll stay put. */
  const patch = (updated: Application) =>
    setFeed((f) =>
      f
        ? {
            ...f,
            applications: f.applications.map((a) => (key(a) === key(updated) ? updated : a)),
          }
        : f
    );

  const rows = useMemo(() => {
    if (!feed) return [];
    const q = query.trim().toLowerCase();
    return feed.applications.filter((a) => {
      if (event !== "all" && a.eventId !== event) return false;
      if (status === "awaiting_payment" && a.payment !== "awaiting") return false;
      if (status !== "all" && status !== "awaiting_payment" && a.status !== status) return false;
      if (!q) return true;
      return [a.name, a.email, a.phone, a.college, a.ticketId, a.teamName, a.teamCode, a.paymentRef]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [feed, query, event, status]);

  const exportCsv = () => {
    const head = [
      "ticketId", "event", "status", "payment", "paymentRef", "fee", "name", "email",
      "phone", "college", "teamName", "teamCode", "members", "appliedAt",
      "paymentVerifiedBy", "paymentVerifiedAt", "confirmationEmailAt",
    ];
    const body = rows.map((r) =>
      [
        r.ticketId, r.eventName, r.status, r.payment, r.paymentRef ?? "", r.fee, r.name,
        r.email, r.phone, r.college, r.teamName ?? "", r.teamCode ?? "",
        readMembers(r.members).join(" | "), r.appliedAt, r.paymentVerifiedBy ?? "",
        r.paymentVerifiedAt ?? "", r.confirmationEmailAt ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pravrutti-registrations-${event}-${status}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (me.ready && !me.signedIn)
    return (
      <DashboardShell>
        <Notice title="Sign in required">Sign in with your organiser account to open the registrations list.</Notice>
      </DashboardShell>
    );

  if (!dash.ready)
    return (
      <DashboardShell title="Registrations">
        <ListSkeleton rows={8} />
      </DashboardShell>
    );

  if (dash.role !== "organiser")
    return (
      <DashboardShell>
        <Notice title="Organisers only">
          This page holds contact and payment details for the whole fest, so it is limited to
          organisers. Coordinators can see their own event roster on the{" "}
          <Link href="/dashboard" className="text-champagne-gold hover:underline">dashboard</Link>.
        </Notice>
      </DashboardShell>
    );

  return (
    <DashboardShell
      wide
      eyebrow={
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Fest control
        </Link>
      }
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black">Registrations</h1>
          <p className="mt-1 text-sm text-white/45">
            Every application, the details each person filled in, and payment verification.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" size="lg" onClick={load}>
            {state === "loading" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
          <Button variant="brand" size="lg" onClick={exportCsv} disabled={!rows.length}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      {feed && !feed.mailConfigured && (
        <Notice title="Ticket emails are off" tone="warning">
          Mail isn&apos;t configured, so verifying a payment approves the applicant without emailing
          their ticket. Set <code className="text-xs">RESEND_API_KEY</code> and{" "}
          <code className="text-xs">MAIL_FROM</code> to switch confirmation emails on.
        </Notice>
      )}

      {state === "error" && (
        <Notice title="Couldn't load registrations" tone="danger">
          The store didn&apos;t respond. Your access is fine — this is a problem at our end.
        </Notice>
      )}

      {feed && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Applications" value={feed.totals.all} />
            <StatTile label="In review" value={feed.totals.pending} />
            <StatTile label="Payment due" value={feed.totals.awaitingPayment} />
            <StatTile label="Paid" value={feed.totals.paid} />
            <StatTile label="Confirmed" value={feed.totals.confirmed} />
            <StatTile label="Tickets emailed" value={feed.totals.emailed} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, phone, ticket, team, payment ID"
                aria-label="Search registrations"
                className="h-10 rounded-xl border-white/[0.10] bg-white/[0.05] pl-9 text-white placeholder:text-white/30 focus-visible:ring-cyber-pink/70"
              />
            </label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger
                aria-label="Filter by event"
                className="h-10 min-w-[180px] rounded-xl border-white/[0.10] bg-midnight-navy text-white/80"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-royal-wine bg-cosmic-purple text-pearl-white">
                <SelectItem value="all">All events</SelectItem>
                {feed.events.map((e) => (
                  <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <FilterGroup value={status} options={STATUS_FILTERS} onChange={setStatus} label="Filter by status" />
            <span className="ml-auto self-center text-xs tabular-nums text-white/35">{rows.length} shown</span>
          </div>

          <Card className="gap-0 overflow-hidden rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 py-0 shadow-none">
            {state === "loading" && rows.length === 0 ? (
              <ListSkeleton />
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-white/40">Nothing matches these filters.</p>
            ) : (
              <div className="divide-y divide-royal-wine/50">
                {rows.map((a) => (
                  <Row
                    key={key(a)}
                    a={a}
                    open={open === key(a)}
                    mailConfigured={feed.mailConfigured}
                    onToggle={() => setOpen(open === key(a) ? null : key(a))}
                    onChanged={patch}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}

/**
 * One applicant. Collapsed it answers "who, which event, are they in" —
 * expanded it is the full form they submitted plus the actions on it, which
 * is the only reason an organiser clicks a name.
 */
function Row({
  a,
  open,
  mailConfigured,
  onToggle,
  onChanged,
}: {
  a: Application;
  open: boolean;
  mailConfigured: boolean;
  onToggle: () => void;
  onChanged: (next: Application) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /* The Juno transaction ID the applicant typed at registration. The desk
     reads it and checks it against the statement; it never edits it — an
     ID an organiser could rewrite is not evidence of anything. */
  const storedRef = readPaymentRef(a.paymentRef);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (
    action: "verify_payment" | "unverify_payment" | "decline" | "resend_confirmation"
  ) => {
    setBusy(action);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/dashboard/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventId: a.eventId, email: a.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't go through.");
      onChanged(data.application);

      // Mail is reported separately from the decision, because the decision
      // sticks even when the send fails.
      if (data.mail?.sent) setFlash("Ticket emailed.");
      else if (data.mail?.skipped) setFlash("Saved. Mail isn't configured, so no email went out.");
      else if (data.mail?.error) setError(`Saved, but the email failed: ${data.mail.error}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(null);
    }
  };

  const showQr = async () => {
    setBusy("qr");
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/applications?qr=${encodeURIComponent(`${a.eventId}:${a.email}`)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't build that QR.");
      setQr(data.qr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build that QR.");
    } finally {
      setBusy(null);
    }
  };

  const copyTicket = async () => {
    await navigator.clipboard.writeText(a.ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const members = readMembers(a.members);
  const working = busy !== null;
  const spin = (id: string, Icon: typeof Check) =>
    busy === id ? <Loader2 className="animate-spin" /> : <Icon />;

  const mailHint = !mailConfigured
    ? "Mail isn't configured"
    : a.status !== "confirmed"
      ? "Only a confirmed applicant has a ticket to send"
      : null;
  const qrHint = a.status !== "confirmed" ? "No ticket until this application is confirmed" : null;

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          open ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-champagne-gold">{a.name}</span>
          <span className="block truncate text-xs text-white/40">{a.email}</span>
        </span>
        <span className="hidden w-44 min-w-0 shrink-0 md:block">
          <span className="block truncate text-xs text-white/70">{a.eventName}</span>
          <span className="block truncate text-[11px] tracking-wider text-white/30">{a.ticketId}</span>
        </span>
        <PayStatusBadge payment={a.payment} />
        <AppStatusBadge status={a.status} />
      </button>

      {open && (
        <div className="space-y-4 bg-white/[0.02] px-4 pb-5 pt-1">
          <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            <Detail k="Name">{a.name}</Detail>
            <Detail k="Event">{a.eventName}</Detail>
            <Detail k="Email">
              <a href={`mailto:${a.email}`} className="break-all text-champagne-gold hover:underline">{a.email}</a>
            </Detail>
            <Detail k="Phone">
              <a href={`tel:${a.phone}`} className="text-champagne-gold hover:underline">{a.phone}</a>
            </Detail>
            <Detail k="College">{a.college}</Detail>
            <Detail k="Fee">{a.fee}</Detail>
            {a.teamName && <Detail k="Team">{a.teamName}</Detail>}
            {a.teamCode && <Detail k="Team code">{a.teamCode}</Detail>}
            <Detail k="Applied">{when(a.appliedAt)}</Detail>
            <Detail k="Ticket ID">
              <button onClick={copyTicket} className="inline-flex items-center gap-1.5 text-champagne-gold hover:underline">
                {a.ticketId} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </Detail>
            {members.length > 0 && (
              <Detail k="Members">
                <span className="block space-y-0.5">
                  {members.map((m, i) => (
                    <span key={i} className="block text-white/70">{m}</span>
                  ))}
                </span>
              </Detail>
            )}
            {a.checkedInAt && <Detail k="Checked in">{when(a.checkedInAt)}</Detail>}
            <Detail k="Juno txn ID">
              {storedRef ? (
                <span className="break-all tracking-wider">{storedRef}</span>
              ) : a.payment === "not_required" ? (
                "None — this application isn't charged"
              ) : (
                "Not given at registration"
              )}
            </Detail>
          </dl>

          <Card className="gap-3 rounded-xl border-white/[0.08] bg-midnight-navy/60 p-4 shadow-none">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">Payment</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <PayStatusBadge payment={a.payment} />
              {a.paymentVerifiedBy && (
                <span className="text-xs text-white/40">
                  verified by {a.paymentVerifiedBy}
                  {a.paymentVerifiedAt ? ` · ${when(a.paymentVerifiedAt)}` : ""}
                </span>
              )}
            </div>

            <div className="text-sm">
              <span className="mb-1 block text-xs text-white/45">Juno transaction ID</span>
              {storedRef ? (
                <span className="break-all font-semibold tracking-wider text-pearl-white">{storedRef}</span>
              ) : a.payment === "not_required" ? (
                <span className="text-white/45">Not charged</span>
              ) : (
                <span className="text-champagne-gold">Not given at registration — ask the applicant for their Juno receipt before verifying.</span>
              )}
            </div>
            {a.payment === "not_required" && !storedRef && (
              <p className="text-xs text-white/35">
                No payment on this row
                {a.teamCode ? " — the team lead's payment ID is on their registration." : "."}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {a.payment === "paid" ? (
                <ConfirmAction
                  title="Undo this payment verification?"
                  description={`${a.name} goes back to "payment due". Their ticket stays issued until you decline the application.`}
                  confirmLabel="Undo verification"
                  onConfirm={() => act("unverify_payment")}
                >
                  <Button variant="subtle" size="default" disabled={working}>
                    {spin("unverify_payment", X)} Undo verification
                  </Button>
                </ConfirmAction>
              ) : (
                <Button
                  variant="success"
                  size="default"
                  onClick={() => act("verify_payment")}
                  disabled={working}
                >
                  {spin("verify_payment", Check)}
                  {a.payment === "not_required" ? "Approve" : "Verify payment & approve"}
                </Button>
              )}

              <Hint text={mailHint}>
                <Button
                  variant="subtle"
                  size="default"
                  onClick={() => act("resend_confirmation")}
                  disabled={working || !!mailHint}
                >
                  {spin("resend_confirmation", Mail)}
                  {a.confirmationEmailAt ? "Resend ticket email" : "Email ticket"}
                </Button>
              </Hint>

              <Hint text={qrHint}>
                <Button variant="subtle" size="default" onClick={showQr} disabled={working || !!qrHint}>
                  {spin("qr", QrCode)} Show QR
                </Button>
              </Hint>

              {a.status !== "declined" && (
                <ConfirmAction
                  title={`Decline ${a.name}?`}
                  description={
                    a.payment === "paid"
                      ? "Their application is closed and the fee is marked for a full refund. They will not be admitted."
                      : "Their application is closed. They will not be admitted."
                  }
                  confirmLabel={a.payment === "paid" ? "Decline + refund" : "Decline"}
                  destructive
                  onConfirm={() => act("decline")}
                >
                  <Button variant="subtle" size="default" disabled={working} className="text-white/50">
                    {spin("decline", X)} Decline{a.payment === "paid" ? " + refund" : ""}
                  </Button>
                </ConfirmAction>
              )}
            </div>

            <p className="text-xs text-white/35">
              {a.confirmationEmailAt
                ? `Ticket emailed ${when(a.confirmationEmailAt)}.`
                : "No ticket email sent yet."}
              {a.confirmationEmailError ? ` Last error: ${a.confirmationEmailError}` : ""}
            </p>

            <p aria-live="polite" className="text-xs">
              {flash && <span className="text-success-soft">{flash}</span>}
              {error && <span className="text-danger">{error}</span>}
            </p>
          </Card>

          {qr && (
            <Card className="flex-row items-center gap-4 rounded-xl border-white/[0.08] bg-midnight-navy/60 p-4 shadow-none">
              <Image src={qr} alt={`Entry QR for ${a.name}`} width={132} height={132} unoptimized className="rounded-lg" />
              <div className="space-y-1 text-xs text-white/45">
                <p className="font-semibold tracking-wider text-white/70">{a.ticketId}</p>
                <p>This is the same QR the applicant sees on their ticket page and receives by email.</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-white/40 hover:text-white/80" onClick={() => setQr(null)}>
                  Hide
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-white/35">{k}</dt>
      <dd className="min-w-0 text-white/80">{children}</dd>
    </div>
  );
}
