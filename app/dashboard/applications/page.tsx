"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navigation } from "@/components/landing/navigation";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { readPaymentRef, type Application, type AppStatus, type PayStatus } from "@/lib/applications";
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

const STATUS_TONE: Record<AppStatus, string> = {
  pending: "bg-soft-gold/15 border-soft-gold/45 text-champagne-gold",
  confirmed: "bg-[#12B76A]/15 border-[#12B76A]/45 text-[#7BE3A8]",
  declined: "bg-white/[0.06] border-white/[0.12] text-white/45",
};

const PAY_LABEL: Record<PayStatus, string> = {
  not_required: "No payment",
  awaiting: "Payment due",
  paid: "Paid",
  refunded: "Refunded",
};

const PAY_TONE: Record<PayStatus, string> = {
  not_required: "bg-white/[0.05] border-white/[0.12] text-white/50",
  awaiting: "bg-soft-gold/15 border-soft-gold/45 text-champagne-gold",
  paid: "bg-[#12B76A]/15 border-[#12B76A]/45 text-[#7BE3A8]",
  refunded: "bg-white/[0.05] border-white/[0.12] text-white/45",
};

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
    return <Shell><Note title="Sign in required">Sign in with your organiser account to open the registrations list.</Note></Shell>;

  if (!dash.ready) return <Shell><p className="text-white/50">Loading…</p></Shell>;

  if (dash.role !== "organiser")
    return (
      <Shell>
        <Note title="Organisers only">
          This page holds contact and payment details for the whole fest, so it is limited to
          organisers. Coordinators can see their own event roster on the{" "}
          <Link href="/dashboard" className="text-champagne-gold hover:underline">dashboard</Link>.
        </Note>
      </Shell>
    );

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Fest control
          </Link>
          <h1 className="font-orbitron text-3xl font-black">Registrations</h1>
          <p className="text-sm text-white/45 mt-1">
            Every application, the details each person filled in, and payment verification.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 h-10 text-sm text-white/70 hover:text-white hover:border-white/25 transition-colors"
          >
            {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-xl bg-cyber-pink px-4 h-10 text-sm font-semibold text-white hover:bg-[#c23f7d] disabled:opacity-40 transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {feed && !feed.mailConfigured && (
        <p className="mb-5 rounded-xl border border-soft-gold/35 bg-soft-gold/[0.08] px-4 py-3 text-sm text-champagne-gold">
          Mail isn&apos;t configured, so verifying a payment will approve the applicant without
          emailing their ticket. Set <code className="font-mono text-xs">RESEND_API_KEY</code> and{" "}
          <code className="font-mono text-xs">MAIL_FROM</code> to switch confirmation emails on.
        </p>
      )}

      {state === "error" && (
        <Note title="Couldn't load registrations">
          The store didn&apos;t respond. Your access is fine — this is a problem at our end.
        </Note>
      )}

      {feed && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Tile label="Applications" v={feed.totals.all} />
            <Tile label="In review" v={feed.totals.pending} />
            <Tile label="Payment due" v={feed.totals.awaitingPayment} />
            <Tile label="Paid" v={feed.totals.paid} />
            <Tile label="Confirmed" v={feed.totals.confirmed} />
            <Tile label="Tickets emailed" v={feed.totals.emailed} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, phone, ticket, team, payment ID"
                aria-label="Search registrations"
                className="w-full h-10 rounded-xl border border-white/[0.10] bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyber-pink/70"
              />
            </label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              aria-label="Filter by event"
              className="h-10 rounded-xl border border-white/[0.10] bg-midnight-navy px-3 text-sm text-white/80"
            >
              <option value="all">All events</option>
              {feed.events.map((e) => (
                <option key={e.eventId} value={e.eventId}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatus(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs border transition-colors ${
                  status === f.id
                    ? "bg-neon-purple/40 text-champagne-gold border-cyber-pink/50"
                    : "bg-white/[0.03] text-white/50 border-white/[0.08] hover:text-white/80"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-white/35 tabular-nums">
              {rows.length} shown
            </span>
          </div>

          <div className="rounded-2xl border border-royal-wine/70 bg-cosmic-purple/40 divide-y divide-royal-wine/50 overflow-hidden">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-white/40">
                {state === "loading" ? "Loading…" : "Nothing matches these filters."}
              </p>
            ) : (
              rows.map((a) => (
                <Row
                  key={key(a)}
                  a={a}
                  open={open === key(a)}
                  mailConfigured={feed.mailConfigured}
                  onToggle={() => setOpen(open === key(a) ? null : key(a))}
                  onChanged={patch}
                />
              ))
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function Tile({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-2xl border border-royal-wine bg-cosmic-purple/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="font-orbitron font-black text-xl text-champagne-gold mt-1 tabular-nums">{v}</p>
    </div>
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
  const storedRef = readPaymentRef(a.paymentRef);
  const [ref, setRef] = useState(storedRef);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setRef(readPaymentRef(a.paymentRef)), [a.paymentRef]);

  const act = async (
    action: "verify_payment" | "unverify_payment" | "decline" | "set_payment_ref" | "resend_confirmation",
    extra?: { paymentRef?: string | null }
  ) => {
    setBusy(action);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/dashboard/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventId: a.eventId, email: a.email, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't go through.");
      onChanged(data.application);

      // Mail is reported separately from the decision, because the decision
      // sticks even when the send fails.
      if (data.mail?.sent) setFlash("Ticket emailed.");
      else if (data.mail?.skipped) setFlash("Saved. Mail isn't configured, so no email went out.");
      else if (data.mail?.error) setError(`Saved, but the email failed: ${data.mail.error}`);
      else if (action === "set_payment_ref") setFlash("Payment ID saved.");
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

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          open ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-champagne-gold truncate">{a.name}</span>
          <span className="block text-xs text-white/40 truncate">{a.email}</span>
        </span>
        <span className="hidden md:block min-w-0 w-44 shrink-0">
          <span className="block text-xs text-white/70 truncate">{a.eventName}</span>
          <span className="block text-[11px] font-mono text-white/30 truncate">{a.ticketId}</span>
        </span>
        <Chip className={PAY_TONE[a.payment]}>{PAY_LABEL[a.payment]}</Chip>
        <Chip className={STATUS_TONE[a.status]}>{a.status}</Chip>
      </button>

      {open && (
        <div className="px-4 pb-5 pt-1 bg-white/[0.02] space-y-4">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <Detail k="Name">{a.name}</Detail>
            <Detail k="Event">{a.eventName}</Detail>
            <Detail k="Email">
              <a href={`mailto:${a.email}`} className="text-champagne-gold hover:underline break-all">{a.email}</a>
            </Detail>
            <Detail k="Phone">
              <a href={`tel:${a.phone}`} className="text-champagne-gold hover:underline">{a.phone}</a>
            </Detail>
            <Detail k="College">{a.college}</Detail>
            <Detail k="Fee">{a.fee}</Detail>
            {a.teamName && <Detail k="Team">{a.teamName}</Detail>}
            {a.teamCode && <Detail k="Team code"><span className="font-mono">{a.teamCode}</span></Detail>}
            <Detail k="Applied">{when(a.appliedAt)}</Detail>
            <Detail k="Ticket ID">
              <button
                onClick={copyTicket}
                className="inline-flex items-center gap-1.5 font-mono text-champagne-gold hover:underline"
              >
                {a.ticketId} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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
            <Detail k="Payment ID">
              {storedRef ? (
                <span className="font-mono break-all">{storedRef}</span>
              ) : a.payment === "not_required" ? (
                "None — this application isn't charged"
              ) : (
                "Not given at registration"
              )}
            </Detail>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-midnight-navy/60 p-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">Payment</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Chip className={PAY_TONE[a.payment]}>{PAY_LABEL[a.payment]}</Chip>
              {a.paymentVerifiedBy && (
                <span className="text-xs text-white/40">
                  verified by {a.paymentVerifiedBy}
                  {a.paymentVerifiedAt ? ` · ${when(a.paymentVerifiedAt)}` : ""}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[200px]">
                <span className="block text-xs text-white/45 mb-1">Payment ID / UTR</span>
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder={storedRef ? undefined : "e.g. 4183 7712 9930"}
                  aria-label="Payment ID / UTR"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-10 rounded-lg border border-white/[0.10] bg-white/[0.05] px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-cyber-pink/70"
                />
              </label>
              <button
                onClick={() => act("set_payment_ref", { paymentRef: ref })}
                disabled={working || readPaymentRef(ref) === storedRef}
                className="h-10 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-sm text-white/70 hover:text-white disabled:opacity-40 transition-colors"
              >
                {busy === "set_payment_ref" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save ID"}
              </button>
            </div>
            {a.payment === "not_required" && !storedRef && (
              <p className="text-xs text-white/35">
                No payment on this row
                {a.teamCode ? " — the team lead's payment ID is on their registration." : "."}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {a.payment === "paid" ? (
                <button
                  onClick={() => act("unverify_payment")}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 h-9 text-xs text-white/60 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {busy === "unverify_payment" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Undo verification
                </button>
              ) : (
                <button
                  onClick={() => act("verify_payment", { paymentRef: ref || null })}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#12B76A]/15 border border-[#12B76A]/45 px-3 h-9 text-xs font-semibold text-[#7BE3A8] hover:bg-[#12B76A]/25 disabled:opacity-40 transition-colors"
                >
                  {busy === "verify_payment" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {a.payment === "not_required" ? "Approve" : "Verify payment & approve"}
                </button>
              )}

              <button
                onClick={() => act("resend_confirmation")}
                disabled={working || a.status !== "confirmed" || !mailConfigured}
                title={
                  !mailConfigured
                    ? "Mail isn't configured"
                    : a.status !== "confirmed"
                    ? "Only a confirmed applicant has a ticket to send"
                    : undefined
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 h-9 text-xs text-white/70 hover:text-white disabled:opacity-40 transition-colors"
              >
                {busy === "resend_confirmation" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {a.confirmationEmailAt ? "Resend ticket email" : "Email ticket"}
              </button>

              <button
                onClick={showQr}
                disabled={working || a.status !== "confirmed"}
                title={a.status !== "confirmed" ? "No ticket until this application is confirmed" : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 h-9 text-xs text-white/70 hover:text-white disabled:opacity-40 transition-colors"
              >
                {busy === "qr" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                Show QR
              </button>

              {a.status !== "declined" && (
                <button
                  onClick={() => act("decline")}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 h-9 text-xs text-white/50 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {busy === "decline" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Decline{a.payment === "paid" ? " + refund" : ""}
                </button>
              )}
            </div>

            <p className="text-xs text-white/35">
              {a.confirmationEmailAt
                ? `Ticket emailed ${when(a.confirmationEmailAt)}.`
                : "No ticket email sent yet."}
              {a.confirmationEmailError ? ` Last error: ${a.confirmationEmailError}` : ""}
            </p>

            {flash && <p className="text-xs text-[#7BE3A8]">{flash}</p>}
            {error && <p className="text-xs text-[#F87171]">{error}</p>}
          </div>

          {qr && (
            <div className="rounded-xl border border-white/[0.08] bg-midnight-navy/60 p-4 flex items-center gap-4">
              <Image
                src={qr}
                alt={`Entry QR for ${a.name}`}
                width={132}
                height={132}
                unoptimized
                className="rounded-lg"
              />
              <div className="text-xs text-white/45 space-y-1">
                <p className="text-white/70 font-semibold">{a.ticketId}</p>
                <p>This is the same QR the applicant sees on their ticket page and receives by email.</p>
                <button onClick={() => setQr(null)} className="text-white/40 hover:text-white/80 underline underline-offset-2">
                  Hide
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      {children}
    </span>
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

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
      <p className="font-semibold mb-1.5">{title}</p>
      <p className="text-sm text-white/50">{children}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-transparent text-pearl-white">
      <Navigation />
      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-6 py-28 font-ui">{children}</div>
    </main>
  );
}
