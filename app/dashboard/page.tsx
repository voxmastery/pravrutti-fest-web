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
import { AccessPanel } from "@/components/dashboard/access-panel";
import { AlertTriangle, Check, ChevronDown, ClipboardList, FileSpreadsheet, Star } from "lucide-react";

type Counts = {
  registered: number; teams: number;
  confirmed: number; confirmedTeams: number;
  checkedIn: number; notArrived: number;
};
/** Contact fields arrive only for organisers — see the event route. */
type Entry = {
  name: string;
  college: string;
  status: string;
  checkedInAt: string | null;
  /** Team display name, or null for someone who entered alone. */
  team: string | null;
  /** Shared by everyone who entered together. */
  group: string;
  /** Holds a place. Withdrawn teammates are listed but not counted, and a
      teammate holds a place only while their lead does. */
  live: boolean;
  /** Who pays for the team ("lead") and who is covered ("member"). */
  role?: "lead" | "member" | null;
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
  capacityTeams: number | null;
  /** A team event, or one where people may enter alone. */
  unit: "team" | "entry";
  registered: number;
  teams: number;
  confirmed: number;
  confirmedTeams: number;
  checkedIn: number;
  fill: number | null;
};
type Overview = {
  phase: "before" | "during" | "after";
  totals: {
    registered: number; teams: number;
    confirmed: number; confirmedTeams: number;
    checkedIn: number; capacity: number;
  };
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

  if (dash.role === "none" && dash.faculty)
    return (
      <DashboardShell title="Dashboard">
        <Notice title="You have faculty access">
          Every event&apos;s teams and participants are on the{" "}
          <Link href="/faculty" className="text-cyber-pink hover:underline">
            faculty board
          </Link>
          .
        </Notice>
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

  /* Their dashboards are switched off for this event (an organiser's setting,
     lib/access-control.ts), which reaches here as a coordinator holding no
     events. Say so plainly — an empty roster would read as their event having
     lost its applicants. */
  if (dash.role === "coordinator" && dash.events.length === 0)
    return (
      <DashboardShell title="Dashboard">
        <Notice title="Coordinator dashboards are switched off for now">
          Your access is still in place — an organiser has paused these dashboards. Nothing is
          lost, and your event&apos;s roster will be here when they turn it back on.
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
          <StatInline label="Teams" value={totals.teams} />
          <StatInline label="Students" value={totals.registered} />
          <StatInline label="Confirmed teams" value={totals.confirmedTeams} />
          <StatInline label="Confirmed students" value={totals.confirmed} />
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

      {/* Seventy payments read by eye against seventy rows is where the desk
          actually loses its evenings. */}
      <Link
        href="/dashboard/approve"
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-royal-wine bg-cosmic-purple/60 px-5 py-4 transition-colors hover:border-cyber-pink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
      >
        <span>
          <span className="block font-semibold text-champagne-gold">Approve from the payment report</span>
          <span className="block text-sm text-white/45">
            Upload the college&apos;s sheet, see who it pays for, confirm them in one go
          </span>
        </span>
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-cyber-pink" />
      </Link>

      {/* Discoverize screens abstracts before it charges anybody, so its
          shortlist is a decision of its own — and its coordinators make it. */}
      <Link
        href="/dashboard/discoverize"
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-royal-wine bg-cosmic-purple/60 px-5 py-4 transition-colors hover:border-cyber-pink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
      >
        <span>
          <span className="block font-semibold text-champagne-gold">Discoverize screening</span>
          <span className="block text-sm text-white/45">
            Abstracts in, and the teams shortlisted for the presentation round
          </span>
        </span>
        <Star className="h-5 w-5 shrink-0 text-cyber-pink" />
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
              <TableHead className="w-36 text-right text-white/40">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <EventRow key={r.eventId} r={r} open={open === r.eventId} onToggle={() => setOpen(open === r.eventId ? null : r.eventId)} />
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Organiser-only, and enforced as such by /api/admin/access — this is
          where organisers are granted and coordinator dashboards switched. */}
      <Card className="mt-6 rounded-3xl border-royal-wine bg-cosmic-purple/30 p-6 shadow-none sm:p-8">
        <AccessPanel />
      </Card>
    </DashboardShell>
  );
}

/** A row is its own summary — the fill bar means "which need attention" is
    answerable by scanning, without opening anything. */
function EventRow({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  const pct = r.fill === null ? null : Math.round(r.fill * 100);
  /* Read off the same fill the bar draws, so the warning and the bar can
     never tell different stories — and fill is measured in whichever unit
     the event is actually capped in. */
  const empty = r.fill !== null && r.fill < 0.25;
  const full = r.fill !== null && r.fill >= 1;
  const unitWord = r.unit === "team" ? "team" : "entry";
  const unitWords = r.unit === "team" ? "teams" : "entries";

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
        {/* Both units, because one number answered two questions badly: a
            coordinator read Line Follower's 33 as 33 teams when it was 33
            students in 17. The field size leads; the head count follows. */}
        <TableCell className="text-right tabular-nums">
          <span className="block font-semibold text-pearl-white">
            {r.teams}
            {r.capacityTeams !== null && <span className="font-normal text-white/35"> / {r.capacityTeams}</span>}
            <span className="font-normal text-white/50"> {r.teams === 1 ? unitWord : unitWords}</span>
          </span>
          <span className="block text-[11px] text-white/40">
            {r.registered} {r.registered === 1 ? "student" : "students"}
            {r.checkedIn > 0 && ` \u00b7 ${r.checkedIn} in`}
          </span>
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
  const [view, setView] = useState<View>("all");

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
        <StatInline label="Teams" value={data.counts.teams} />
        <StatInline label="Students" value={data.counts.registered} />
        <StatInline label="Confirmed teams" value={data.counts.confirmedTeams} />
        <StatInline label="Confirmed students" value={data.counts.confirmed} />
        <StatInline label="Checked in" value={data.counts.checkedIn} />
        <StatInline label="Not arrived" value={data.counts.notArrived} />
      </div>

      {data.roster.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <FilterGroup
            value={view}
            onChange={setView}
            label="Show who"
            options={VIEWS.map((v) => ({
              id: v.id,
              label: `${v.label} (${v.id === "all" ? data.roster.length : data.roster.filter((p) => stageOf(p) === v.id).length})`,
            }))}
          />
          <p className="text-xs text-white/40">{VIEWS.find((v) => v.id === view)?.hint}</p>
        </div>
      )}

      <Card className="max-h-[380px] gap-0 divide-y divide-white/[0.05] overflow-y-auto rounded-xl border-white/[0.08] bg-midnight-navy/60 py-0 shadow-none">
        {(() => {
          const shown = view === "all" ? data.roster : data.roster.filter((p) => stageOf(p) === view);
          if (data.roster.length === 0)
            return <p className="p-5 text-sm text-white/45">No registrations yet.</p>;
          if (shown.length === 0)
            return <p className="p-5 text-sm text-white/45">Nobody here right now.</p>;
          return groupRoster(shown).map((g) => <RosterGroup key={g.key} g={g} view={view} />);
        })()}
      </Card>
    </div>
  );
}

/**
 * Where somebody stands, as a coordinator needs to know it.
 *
 * "Didn't finish" is somebody who started registering, left for the payment
 * portal and never came back with a receipt — they hold no place, and a call
 * from the coordinator is often all it takes. "In review" has paid, or quoted
 * a payment ID, and is waiting on an organiser to verify it.
 */
type Stage = "confirmed" | "review" | "unfinished" | "withdrew";
type View = "all" | Exclude<Stage, "withdrew">;

const stageOf = (p: Entry): Stage =>
  p.status === "confirmed"
    ? "confirmed"
    : p.status === "invited"
    ? "unfinished"
    : p.status === "pending"
    ? p.live
      ? "review"
      : "unfinished"
    : "withdrew";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "all", label: "Everyone", hint: "Everyone who has started registering, grouped by team. Withdrawn people are listed but not counted." },
  { id: "confirmed", label: "Confirmed", hint: "Verified and holding a ticket." },
  { id: "review", label: "In review", hint: "Paid, or gave a payment ID — waiting for an organiser to verify it." },
  { id: "unfinished", label: "Didn't finish", hint: "Teammates whose lead never registered the team, or withdrew it, and teammates who haven't accepted their invite — they hold no place yet. Call the lead. (Leads who went to pay and didn't come back are in review.)" },
];

type Group = {
  key: string;
  /** Null for the block of people who entered alone. */
  team: string | null;
  people: Entry[];
  coming: number;
  withdrew: number;
};

const WITHDRAWN = new Set(["cancelled", "declined"]);

/**
 * The roster by team, because a flat list of two hundred names tells a
 * coordinator nothing about who came together — Line Follower read as 33
 * teams when it was 33 students in 17.
 *
 * Teams A\u2013Z, then anyone who entered alone in one block at the end. Inside
 * a team the people coming are listed first; a teammate who withdrew stays on
 * the list, because the desk needs to know, but is not counted in the header.
 * A team nobody is coming for any more sinks below the live ones.
 */
function groupRoster(roster: readonly Entry[]): Group[] {
  const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
  /* The lead first — everyone else on the team stands where they stand —
     then the people coming, then by name. */
  const liveFirst = (a: Entry, b: Entry) =>
    Number(b.role === "lead") - Number(a.role === "lead") || Number(b.live) - Number(a.live) || byName(a, b);
  const summarise = (key: string, team: string | null, people: Entry[]): Group => ({
    key,
    team,
    people: [...people].sort(liveFirst),
    coming: people.filter((p) => p.live).length,
    withdrew: people.filter((p) => !p.live && WITHDRAWN.has(p.status)).length,
  });

  const teams = new Map<string, Entry[]>();
  for (const p of roster) if (p.team !== null) teams.set(p.group, [...(teams.get(p.group) ?? []), p]);
  const solos = roster.filter((p) => p.team === null);

  const grouped = [...teams].map(([key, people]) => summarise(key, people[0].team, people));
  grouped.sort((a, b) => Number(b.coming > 0) - Number(a.coming > 0) || String(a.team).localeCompare(String(b.team)));

  return solos.length ? [...grouped, summarise("solo", null, solos)] : grouped;
}

function RosterGroup({ g, view }: { g: Group; view: View }) {
  /* In a filtered view everyone shown is the point, so the header counts
     them; in "everyone" it counts only the people coming. */
  const all = view === "all";
  const n = all ? g.coming : g.people.length;
  /* A team with nobody holding a place reads "0 members" otherwise, which
     says nothing about why. */
  const label =
    all && n === 0
      ? g.withdrew === g.people.length ? "withdrew" : "not registered"
      : `${n}${all ? (g.team === null ? "" : n === 1 ? " member" : " members") : n === 1 ? " person" : " people"}`;
  return (
    <section aria-label={g.team ?? "Individual entries"}>
      <header className="flex items-baseline justify-between gap-4 bg-white/[0.04] px-4 py-2">
        <span className={`min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider ${g.coming ? "text-pearl-white/80" : "text-white/35"}`}>
          {g.team ?? "Individual entries"}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {label}
          {all && n > 0 && g.withdrew > 0 && <span className="text-white/30">{` \u00b7 ${g.withdrew} withdrew`}</span>}
        </span>
      </header>
      <div className="divide-y divide-white/[0.04]">
        {g.people.map((p, i) => (
          <div key={i} className={p.live || !all ? "" : "opacity-60"}>
            <Participant p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One roster line. For an organiser the name is a button that opens the
 * person's contact details and payment record. A coordinator gets no payment
 * record, so their row is plain — with the phone and email on it, to ring or
 * write to straight from the list.
 */
function Participant({ p }: { p: Entry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = p.payment !== undefined;
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
  ) : p.status === "invited" ? (
    /* On the team list with no registration of their own — usually an invite
       not yet accepted — so no ticket yet. */
    <span className="text-xs text-white/35">Not registered yet</span>
  ) : p.status === "pending" && !p.live && p.role === "member" ? (
    /* They did their part, but their lead never registered the team, or
       withdrew it — and nobody on a team holds a place without its lead. */
    <span className="text-xs text-white/35">Lead not registered</span>
  ) : p.status === "pending" && !p.live ? (
    /* Started, left for the payment portal, never came back with a receipt.
       "In review" would claim somebody is looking at it; nobody is, and it
       holds no place. */
    <span className="text-xs text-white/35">Didn&apos;t finish</span>
  ) : (
    <AppStatusBadge status={p.status} />
  );

  const row = (
    <>
      <span className="min-w-0 text-left">
        <span className={`flex items-center gap-2 truncate text-sm font-medium ${hasDetail ? "text-champagne-gold" : "text-pearl-white"}`}>
          <span className="truncate">{p.name}</span>
          {p.role === "lead" && (
            <span className="shrink-0 rounded border border-champagne-gold/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-champagne-gold/90">
              Lead
            </span>
          )}
        </span>
        <span className="block truncate text-sm text-white/40">{p.college}</span>
        {!hasDetail && (p.phone || p.email) && (
          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {p.phone && (
              <a href={`tel:${p.phone}`} className="tabular-nums text-champagne-gold hover:underline">{p.phone}</a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="break-all text-champagne-gold/80 hover:underline">{p.email}</a>
            )}
          </span>
        )}
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
