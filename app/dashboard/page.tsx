"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { StatInline } from "@/components/dashboard/stat-tile";
import { FilterGroup } from "@/components/dashboard/filter-group";
import { AppStatusBadge } from "@/components/dashboard/status-badge";
import { AlertTriangle, Check, ChevronDown, ClipboardList } from "lucide-react";

type Counts = { registered: number; confirmed: number; checkedIn: number; notArrived: number };
/** Contact fields arrive only for organisers — see the event route. */
type Entry = {
  name: string;
  college: string;
  status: string;
  checkedInAt: string | null;
  email?: string;
  phone?: string;
  teamName?: string | null;
  members?: string | null;
  payment?: string;
  appliedAt?: string;
  paymentVerifiedBy?: string | null;
  paymentVerifiedAt?: string | null;
  paymentRef?: string | null;
};

type Row = {
  eventId: string;
  name: string;
  category: string;
  venue: string | null;
  capacity: number | null;
  registered: number;
  confirmed: number;
  checkedIn: number;
  fill: number | null;
};
type Overview = {
  phase: "before" | "during" | "after";
  totals: { registered: number; confirmed: number; checkedIn: number; capacity: number };
  events: Row[];
};

type Sort = "fill" | "name" | "registered";

const SORTS: { id: Sort; label: string }[] = [
  { id: "fill", label: "Emptiest first" },
  { id: "registered", label: "Most signups" },
  { id: "name", label: "A–Z" },
];

export default function DashboardPage() {
  const me = useIdentity();
  const dash = useDashboardRole();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [sort, setSort] = useState<Sort>("fill");
  const [open, setOpen] = useState<string | null>(null);

  // Organisers land on the fest overview; a coordinator goes straight to
  // their event, because with one or two events an overview is a detour.
  useEffect(() => {
    if (!dash.ready) return;
    if (dash.role === "organiser") {
      fetch("/api/dashboard/overview")
        .then((r) => (r.ok ? r.json() : null))
        .then(setOverview)
        .catch(() => setOverview(null));
    } else if (dash.role === "coordinator" && dash.events.length > 0) {
      setOpen(dash.events[0].eventId);
    }
  }, [dash.ready, dash.role, dash.events]);

  if (me.ready && !me.signedIn)
    return (
      <DashboardShell title="Dashboard">
        <Notice title="Sign in to view your event">Use the account the organising team registered you with.</Notice>
      </DashboardShell>
    );

  if (!dash.ready)
    return (
      <DashboardShell title="Dashboard">
        <ListSkeleton rows={5} />
      </DashboardShell>
    );

  if (dash.role === "none")
    return (
      <DashboardShell title="Dashboard">
        <Notice title="No dashboard access">
          This account isn&apos;t listed as a coordinator for any event. Contact the organising
          team if that looks wrong.
        </Notice>
      </DashboardShell>
    );

  /* Coordinator dashboards are switched off (lib/roles.ts), which reaches here
     as a coordinator holding no events. Say so plainly — an empty roster would
     read as their event having lost its applicants. */
  if (dash.role === "coordinator" && dash.events.length === 0)
    return (
      <DashboardShell title="Dashboard">
        <Notice title="Coordinator dashboards are switched off for now">
          Your access is still in place — the organising team has paused these dashboards while
          registration settles. Nothing is lost, and your event&apos;s roster will be here when
          they turn it back on.
        </Notice>
      </DashboardShell>
    );

  // ── Coordinator: their roster, no overview ──────────────────────────────
  // Pills come from /api/dashboard/me (`dash.events`), never the full catalog.
  if (dash.role === "coordinator") {
    return (
      <DashboardShell title={dash.events.length > 1 ? "My events" : "My event"}>
        {dash.events.length > 1 && open && (
          <div className="mb-6">
            <FilterGroup
              variant="pill"
              value={open}
              options={dash.events.map((e) => ({ id: e.eventId, label: e.name }))}
              onChange={setOpen}
              label="Choose event"
            />
          </div>
        )}
        {open && (
          <>
            <Link
              href={`/events/${open}`}
              className="mb-4 inline-block rounded-lg text-sm text-cyber-pink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
            >
              View event page
            </Link>
            <EventDetail eventId={open} />
          </>
        )}
      </DashboardShell>
    );
  }

  // ── Organiser: the whole fest ───────────────────────────────────────────
  if (!overview)
    return (
      <DashboardShell title="Fest control" wide>
        <Skeleton className="mb-6 h-56 rounded-3xl bg-white/[0.05]" />
        <ListSkeleton rows={6} />
      </DashboardShell>
    );

  const { totals, phase } = overview;
  const during = phase === "during" || phase === "after";

  // The headline answers the question the organiser actually has right now:
  // before the fest, how full are we; during it, who has turned up.
  const headline = during
    ? { n: totals.checkedIn, of: totals.confirmed, label: "arrived", sub: "of confirmed registrations" }
    : { n: totals.registered, of: totals.capacity, label: "places filled", sub: "across all 24 arenas" };

  const pct = headline.of > 0 ? Math.round((headline.n / headline.of) * 100) : 0;

  const rows = [...overview.events].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "registered") return b.registered - a.registered;
    return (a.fill ?? 2) - (b.fill ?? 2); // emptiest first — those need action
  });

  return (
    <DashboardShell title="Fest control" wide>
      {/* One number, largest thing on the page. A dashboard whose primary
          metric can't be found in five seconds has no hierarchy. */}
      <Card className="mb-6 gap-0 rounded-3xl border-royal-wine bg-gradient-to-br from-deep-plum/70 via-cosmic-purple/80 to-midnight-navy p-6 shadow-none sm:p-8">
        <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-cyber-pink">
          {during ? "Check-in progress" : "Registration"}
        </p>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="font-display text-5xl font-black leading-none tabular-nums text-champagne-gold sm:text-6xl">
            {headline.n.toLocaleString("en-IN")}
          </span>
          <span className="pb-1 text-xl tabular-nums text-white/45">
            / {headline.of.toLocaleString("en-IN")} {headline.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/45">{headline.sub}</p>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={headline.label}
          className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyber-pink to-champagne-gold transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <StatInline label="Registered" value={totals.registered} />
          <StatInline label="Confirmed" value={totals.confirmed} />
          <StatInline label="Checked in" value={totals.checkedIn} />
        </div>
      </Card>

      {/* The overview answers "how is the fest doing"; approving a specific
          person is a different job with a different screen. */}
      <Link
        href="/dashboard/applications"
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-royal-wine bg-cosmic-purple/60 px-5 py-4 transition-colors hover:border-cyber-pink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
      >
        <span>
          <span className="block font-semibold text-champagne-gold">Registrations</span>
          <span className="block text-sm text-white/45">
            Every application, submitted details, payment IDs, and ticket emails
          </span>
        </span>
        <ClipboardList className="h-5 w-5 shrink-0 text-cyber-pink" />
      </Link>

      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-black text-pearl-white">All events</h2>
        <FilterGroup value={sort} options={SORTS} onChange={setSort} label="Sort events" />
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 py-0 shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="border-royal-wine/50 hover:bg-transparent">
              <TableHead className="text-white/40">Event</TableHead>
              <TableHead className="hidden w-32 text-white/40 sm:table-cell">Fill</TableHead>
              <TableHead className="w-28 text-right text-white/40">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <EventRow key={r.eventId} r={r} open={open === r.eventId} onToggle={() => setOpen(open === r.eventId ? null : r.eventId)} />
            ))}
          </TableBody>
        </Table>
      </Card>
    </DashboardShell>
  );
}

/** A row is its own summary — the fill bar means "which need attention" is
    answerable by scanning, without opening anything. */
function EventRow({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  const pct = r.fill === null ? null : Math.round(r.fill * 100);
  // Only flagged while there is still time to act on it.
  const empty = r.capacity !== null && r.registered / r.capacity < 0.25;
  const full = r.capacity !== null && r.registered >= r.capacity;

  const bar = full ? "bg-danger" : empty ? "bg-soft-gold" : "bg-cyber-pink";
  const detailId = `event-${r.eventId}`;

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`cursor-pointer border-royal-wine/50 transition-colors ${open ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
      >
        <TableCell className="min-w-0 py-3.5">
          <span className="flex items-center gap-2">
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
            <span className="truncate font-semibold text-pearl-white">{r.name}</span>
            {(empty || full) && (
              <AlertTriangle
                aria-label={full ? "Full" : "Under a quarter full"}
                className={`h-3.5 w-3.5 shrink-0 ${full ? "text-danger" : "text-soft-gold"}`}
              />
            )}
          </span>
          <span className="block truncate pl-[22px] text-sm text-white/40">{r.venue ?? "Venue TBC"}</span>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          {pct !== null ? (
            <>
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </span>
              <span className="mt-1 block text-[11px] tabular-nums text-white/35">{pct}% full</span>
            </>
          ) : (
            <span className="block text-[11px] text-white/25">No cap set</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          <span className="block font-semibold text-pearl-white">
            {r.registered}
            {r.capacity !== null && <span className="font-normal text-white/35"> / {r.capacity}</span>}
          </span>
          <span className="block text-[11px] text-white/40">{r.checkedIn} in</span>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow id={detailId} className="border-royal-wine/50 bg-white/[0.02] hover:bg-white/[0.02]">
          <TableCell colSpan={3} className="px-4 pb-4 pt-0">
            <EventDetail eventId={r.eventId} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The single-event roster, shared by both roles. */
function EventDetail({ eventId }: { eventId: string }) {
  const [data, setData] = useState<{ counts: Counts; roster: Entry[] } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setState("loading");
    fetch(`/api/dashboard/event/${eventId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => { if (!cancelled) { setData(d); setState("ok"); } })
      .catch(() => { if (!cancelled) { setData(null); setState("error"); } });
    return () => { cancelled = true; };
  }, [eventId]);

  if (state === "loading") return <div className="pt-3"><ListSkeleton rows={4} /></div>;

  if (state === "error")
    return (
      <div className="mt-3">
        <Notice title="Couldn't load this roster" tone="danger">
          The registration store didn&apos;t respond. Your access is fine — this is a problem at our end.
        </Notice>
      </div>
    );

  if (!data) return null;

  return (
    <div className="pt-3">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <StatInline label="Registered" value={data.counts.registered} />
        <StatInline label="Confirmed" value={data.counts.confirmed} />
        <StatInline label="Checked in" value={data.counts.checkedIn} />
        <StatInline label="Not arrived" value={data.counts.notArrived} />
      </div>

      <Card className="max-h-[380px] gap-0 divide-y divide-white/[0.05] overflow-y-auto rounded-xl border-white/[0.08] bg-midnight-navy/60 py-0 shadow-none">
        {data.roster.length === 0 ? (
          <p className="p-5 text-sm text-white/45">No registrations yet.</p>
        ) : (
          data.roster.map((p, i) => <Participant key={i} p={p} />)
        )}
      </Card>
      {/* Only true for coordinators now; organisers see them inline. */}
      {data.roster.length > 0 && data.roster[0].email === undefined && (
        <p className="mt-2 text-xs text-white/30">Contact details are held by the organising team.</p>
      )}
    </div>
  );
}

/**
 * One roster line. For an organiser the name is a button that opens the
 * person's contact details; for a coordinator no contact fields arrive, so it
 * stays a plain row rather than an affordance that leads nowhere.
 */
function Participant({ p }: { p: Entry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = p.email !== undefined;
  const paid = p.payment === "paid";

  const team = (() => {
    if (!p.members) return null;
    try {
      const parsed = JSON.parse(p.members);
      if (Array.isArray(parsed))
        return parsed.map((m: { name?: string; phone?: string }) =>
          [m.name, m.phone].filter(Boolean).join(" · ")
        );
    } catch {
      // Older records stored a comma-separated string.
      return p.members.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return null;
  })();

  const status = p.checkedInAt ? (
    <>
      <span className="block text-success-soft">Checked in</span>
      <span className="block text-xs tabular-nums text-white/35">
        {new Date(p.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </>
  ) : p.status === "confirmed" ? (
    <span className="text-white/45">Not arrived</span>
  ) : (
    <AppStatusBadge status={p.status} />
  );

  const row = (
    <>
      <span className="min-w-0 text-left">
        <span className={`block truncate text-sm font-medium ${hasDetail ? "text-champagne-gold" : "text-pearl-white"}`}>
          {p.name}
        </span>
        <span className="block truncate text-sm text-white/40">{p.college}</span>
      </span>
      <span className="shrink-0 text-right text-sm">{status}</span>
    </>
  );

  if (!hasDetail)
    return <div className="flex items-center justify-between gap-4 px-4 py-2.5">{row}</div>;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 transition-colors ${
          open ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
        }`}
      >
        {row}
      </button>

      {open && (
        <dl className="space-y-1.5 bg-white/[0.03] px-4 pb-3 pt-1 text-sm">
          <Detail k="Email">
            <a href={`mailto:${p.email}`} className="break-all text-champagne-gold hover:underline">{p.email}</a>
          </Detail>
          <Detail k="Phone">
            {/* tel: so it dials straight from the phone an organiser is holding. */}
            <a href={`tel:${p.phone}`} className="text-champagne-gold hover:underline">{p.phone}</a>
          </Detail>
          {p.teamName && <Detail k="Team">{p.teamName}</Detail>}
          {team && team.length > 0 && (
            <Detail k="Members">
              <span className="block space-y-0.5">
                {team.map((m, i) => (
                  <span key={i} className="block text-white/70">{m}</span>
                ))}
              </span>
            </Detail>
          )}
          {p.appliedAt && (
            <Detail k="Applied">
              {new Date(p.appliedAt).toLocaleDateString([], { day: "numeric", month: "short" })}
            </Detail>
          )}

          {/* Read-only: verifying happens on /dashboard/applications, which has
              the payment ID and the ticket email alongside it. Two places to
              approve the same person is two places for them to disagree. */}
          <div className="flex gap-3 pt-1.5">
            <dt className="w-20 shrink-0 text-white/35">Payment</dt>
            <dd className="min-w-0 flex-1">
              {paid ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-success-soft">
                    <Check className="h-3.5 w-3.5" /> Verified
                  </span>
                  {p.paymentVerifiedBy && (
                    <span className="text-xs text-white/35">
                      by {p.paymentVerifiedBy}
                      {p.paymentVerifiedAt &&
                        ` · ${new Date(p.paymentVerifiedAt).toLocaleDateString([], { day: "numeric", month: "short" })}`}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-champagne-gold">{(p.payment ?? "awaiting").replace(/_/g, " ")}</span>
              )}
              {p.paymentRef ? <p className="mt-1 break-all text-xs text-white/60">{p.paymentRef}</p> : null}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-white/35">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
