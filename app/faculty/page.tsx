"use client";

import { useEffect, useMemo, useState } from "react";
import { useIdentity } from "@/lib/identity-context";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { StatTile } from "@/components/dashboard/stat-tile";
import { FilterGroup } from "@/components/dashboard/filter-group";
import type { FacultyTeam, FacultyPersonStatus } from "@/lib/faculty-board";
import { Crown, Download, Mail, Phone, Search } from "lucide-react";

/**
 * The faculty board: every event's teams and participants, read-only.
 *
 * There is nothing to press here that changes anything — the API behind it is
 * GET-only. "Confirmed" and "Not confirmed yet" are two views of the same
 * list, and the CSV is the same rows the screen shows.
 */

type Payload = { events: { eventId: string; name: string }[]; teams: FacultyTeam[] };
type View = "confirmed" | "pending";

const STATUS_LABEL: Record<FacultyPersonStatus, string> = {
  confirmed: "Confirmed",
  awaiting: "Awaiting confirmation",
  incomplete: "Registration incomplete",
  invited: "Invited, not accepted",
};

const STATUS_TONE: Record<FacultyPersonStatus, string> = {
  confirmed: "border-success/40 bg-success/10 text-success-soft",
  awaiting: "border-soft-gold/40 bg-soft-gold/10 text-soft-gold",
  incomplete: "border-white/15 bg-white/[0.05] text-white/60",
  invited: "border-white/15 bg-white/[0.05] text-white/60",
};

export default function FacultyPage() {
  const me = useIdentity();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [view, setView] = useState<View>("confirmed");
  const [eventFilter, setEventFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!me.ready || !me.signedIn) return;
    fetch("/api/faculty", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setError({ status: r.status, message: d?.error ?? "Couldn't load the board." });
        else setData(d);
      })
      .catch(() => setError({ status: 0, message: "Couldn't reach the server. Check your connection and reload." }));
  }, [me.ready, me.signedIn, me.email]);

  const names = useMemo(() => new Map((data?.events ?? []).map((e) => [e.eventId, e.name])), [data]);

  const inEvent = useMemo(
    () => (data?.teams ?? []).filter((t) => eventFilter === "all" || t.eventId === eventFilter),
    [data, eventFilter]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inEvent
      .filter((t) => (view === "confirmed" ? t.confirmed : !t.confirmed))
      .filter(
        (t) =>
          !q ||
          (t.name ?? "").toLowerCase().includes(q) ||
          t.people.some((p) => [p.name, p.college, p.email, p.phone].some((v) => v.toLowerCase().includes(q)))
      );
  }, [inEvent, view, query]);

  const counts = useMemo(() => {
    const confirmed = inEvent.filter((t) => t.confirmed);
    const pending = inEvent.filter((t) => !t.confirmed);
    return {
      confirmedTeams: confirmed.length,
      confirmedPeople: confirmed.reduce((n, t) => n + t.people.filter((p) => p.status === "confirmed").length, 0),
      pendingTeams: pending.length,
      pendingPeople: pending.reduce((n, t) => n + t.people.length, 0),
    };
  }, [inEvent]);

  /* Only events that have someone on them, busiest first — a list of 25
     names where most read "0" is harder to use than a short one. */
  const eventOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of data?.teams ?? []) n.set(t.eventId, (n.get(t.eventId) ?? 0) + 1);
    return [...n.entries()]
      .map(([id, count]) => ({ id, count, name: names.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, names]);

  const exportCsv = () => {
    const head = ["Event", "Team", "Name", "Role", "College", "Email", "Phone", "Status", "Checked in"];
    const rows = shown.flatMap((t) =>
      t.people.map((p) =>
        [
          names.get(t.eventId) ?? t.eventId,
          t.solo ? "(solo)" : t.name ?? "",
          p.name,
          p.isLead ? "Lead" : "Member",
          p.college,
          p.email,
          p.phone,
          STATUS_LABEL[p.status],
          p.checkedIn ? "Yes" : "No",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pravrutti-${view === "confirmed" ? "confirmed" : "not-confirmed"}-${eventFilter}.csv`;
    a.click();
  };

  if (me.ready && !me.signedIn)
    return (
      <DashboardShell title="Faculty board">
        <Notice title="Sign in to view the faculty board">
          Use the Google account the organising team gave faculty access to.
        </Notice>
      </DashboardShell>
    );

  if (error)
    return (
      <DashboardShell title="Faculty board">
        <Notice title={error.status === 403 ? "No faculty access" : "Couldn't load the board"} tone={error.status === 403 ? "neutral" : "danger"}>
          {error.status === 403
            ? "This account hasn't been given faculty access. Ask the organising team to add your email."
            : error.message}
        </Notice>
      </DashboardShell>
    );

  if (!data)
    return (
      <DashboardShell title="Faculty board">
        <ListSkeleton rows={6} />
      </DashboardShell>
    );

  return (
    <DashboardShell title="Faculty board" wide>
      <p className="-mt-3 mb-6 text-sm text-white/50">View only. Registrations are managed by the organising team.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Confirmed teams" value={counts.confirmedTeams} />
        <StatTile label="Confirmed participants" value={counts.confirmedPeople} />
        <StatTile label="Teams not confirmed" value={counts.pendingTeams} />
        <StatTile label="People not confirmed" value={counts.pendingPeople} />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <FilterGroup
          variant="pill"
          value={view}
          onChange={setView}
          label="Which teams"
          options={[
            { id: "confirmed", label: `Confirmed (${counts.confirmedTeams})` },
            { id: "pending", label: `Not confirmed yet (${counts.pendingTeams})` },
          ]}
        />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          aria-label="Event"
          className="h-10 rounded-lg border border-royal-wine bg-midnight-navy px-3 text-sm text-pearl-white md:ml-auto"
        >
          <option value="all">All events</option>
          {eventOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.count})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, team, college, email or phone"
            className="h-10 w-full rounded-lg border border-transparent bg-white/[0.08] pl-9 pr-3 text-sm text-pearl-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-pink/70"
          />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!shown.length}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-royal-wine bg-white/[0.06] px-4 text-sm text-pearl-white/80 hover:bg-white/[0.12] disabled:opacity-40 cursor-pointer"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {view === "pending" && (
        <p className="mb-4 text-[13px] leading-relaxed text-white/45">
          People who started registering but are not confirmed: waiting on the organisers, left before finishing
          payment, or added by a team lead and not yet accepted.
        </p>
      )}

      <div className="space-y-3">
        {shown.map((t) => (
          <section key={t.key} className="rounded-2xl border border-royal-wine bg-cosmic-purple/40 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-bold text-champagne-gold">
                {t.solo ? t.people[0]?.name ?? "Solo entry" : t.name || "Unnamed team"}
                {t.solo && <span className="ml-2 text-xs font-normal text-white/40">solo</span>}
              </h2>
              <span className="text-xs text-white/50">
                {names.get(t.eventId) ?? t.eventId} · {t.people.length} {t.people.length === 1 ? "person" : "people"}
              </span>
            </div>
            <ul className="divide-y divide-royal-wine/50">
              {t.people.map((p) => (
                <li key={p.email} className="flex flex-col gap-1.5 py-2.5 md:flex-row md:items-center md:gap-4">
                  <div className="min-w-0 md:w-56">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-pearl-white">
                      {p.isLead && !t.solo && <Crown className="h-3.5 w-3.5 shrink-0 text-soft-gold" aria-label="Team lead" />}
                      <span className="truncate">{p.name}</span>
                    </p>
                    <p className="truncate text-xs text-white/50">{p.college || "College not given"}</p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                    <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-cyber-pink">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{p.email}</span>
                    </a>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 hover:text-cyber-pink">
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {p.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    {p.checkedIn && (
                      <span className="rounded-full border border-cyber-pink/40 bg-cyber-pink/10 px-2 py-0.5 text-[11px] text-cyber-pink">
                        Checked in
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!shown.length && (
          <div className="rounded-2xl border border-dashed border-royal-wine p-10 text-center text-sm text-white/40">
            {query ? "Nothing matches that search." : view === "confirmed" ? "No confirmed teams yet." : "Nobody waiting."}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
