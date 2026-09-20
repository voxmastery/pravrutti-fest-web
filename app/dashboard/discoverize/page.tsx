"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardShell, ListSkeleton, Notice } from "@/components/dashboard/shell";
import { StatTile } from "@/components/dashboard/stat-tile";
import { FilterGroup } from "@/components/dashboard/filter-group";
import { ConfirmAction } from "@/components/dashboard/confirm-action";
import { DISCOVERIZE_EVENT_ID, DISCOVERIZE_STATE_LABEL, type DiscoverizeState } from "@/lib/discoverize";
import { ArrowLeft, Check, Loader2, RefreshCw, Search, Star, X } from "lucide-react";

/**
 * Discoverize's screening desk.
 *
 * The judges read abstracts and decide who presents, so this is the one place
 * a coordinator can change something: shortlist a team, or record an abstract
 * the webhook never saw. It deliberately cannot verify a payment — that stays
 * on /dashboard/applications with an organiser's name against it.
 *
 * There is no cap on the shortlist. How many teams present is the judges'
 * call, and a number here would be a second opinion nobody asked for.
 */

type Member = {
  name: string; email: string; college: string; phone: string;
  status: string; payment: string; paymentRef: string | null; ticketId: string;
};
type Team = {
  key: string;
  teamName: string | null;
  teamCode: string | null;
  state: DiscoverizeState;
  abstractSubmittedAt: string | null;
  shortlistedAt: string | null;
  shortlistedBy: string | null;
  members: Member[];
};

type Filter = "all" | "abstract" | "shortlisted" | "waiting";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "abstract", label: "Abstract in" },
  { id: "waiting", label: "No abstract yet" },
  { id: "shortlisted", label: "Shortlisted" },
];

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export default function DiscoverizeDeskPage() {
  const dash = useDashboardRole();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/dashboard/discoverize", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setTeams(data.teams ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  const allowed = dash.ready && (dash.role === "organiser" || dash.events.some((e) => e.eventId === DISCOVERIZE_EVENT_ID));
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const act = async (team: Team, action: "shortlist" | "unshortlist" | "mark_abstract") => {
    setBusy(team.key + action);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/discoverize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          code: team.teamCode,
          email: team.teamCode ? undefined : team.members[0]?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't go through.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(null);
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams ?? []).filter((t) => {
      if (filter === "abstract" && !t.abstractSubmittedAt) return false;
      if (filter === "waiting" && t.abstractSubmittedAt) return false;
      if (filter === "shortlisted" && !t.shortlistedAt) return false;
      if (!q) return true;
      return [t.teamName, t.teamCode, ...t.members.flatMap((m) => [m.name, m.email, m.college])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [teams, query, filter]);

  const totals = useMemo(() => {
    const t = teams ?? [];
    return {
      teams: t.length,
      abstracts: t.filter((x) => x.abstractSubmittedAt).length,
      shortlisted: t.filter((x) => x.shortlistedAt).length,
      paid: t.filter((x) => x.state === "payment_successful" || x.state === "final_round_confirmed").length,
    };
  }, [teams]);

  return (
    <DashboardShell
      wide
      title="Discoverize"
      eyebrow={
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Fest control
        </Link>
      }
    >
      {!dash.ready ? (
        <ListSkeleton rows={4} />
      ) : !allowed ? (
        <Notice title="Not your event" tone="warning">
          This desk is for Discoverize&apos;s coordinators and the organisers.
        </Notice>
      ) : (
        <>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-white/50">
            Teams enter free and submit an abstract. Shortlist as many as the judges put through —
            there is no cap — and the ₹200 fee appears on the lead&apos;s ticket only for the teams
            you pick. Verifying that payment stays on the registrations desk.
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Teams" value={totals.teams} />
            <StatTile label="Abstracts in" value={totals.abstracts} />
            <StatTile label="Shortlisted" value={totals.shortlisted} />
            <StatTile label="Paid" value={totals.paid} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Team, name, email, college"
                className="h-10 rounded-xl border-royal-wine bg-cosmic-purple/60 pl-9 text-sm"
              />
            </div>
            <Button variant="outline" onClick={load} className="h-10 rounded-xl border-royal-wine bg-cosmic-purple text-xs">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <FilterGroup value={filter} options={FILTERS} onChange={setFilter} label="Filter teams" />
            <span className="ml-auto self-center text-xs tabular-nums text-white/35">{rows.length} shown</span>
          </div>

          {error && <Notice title="That didn't go through" tone="danger">{error}</Notice>}

          <Card className="gap-0 overflow-hidden rounded-2xl border-royal-wine/70 bg-cosmic-purple/40 py-0 shadow-none">
            {state === "loading" && !teams ? (
              <ListSkeleton />
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-white/40">
                {teams?.length ? "Nothing matches these filters." : "No Discoverize teams yet."}
              </p>
            ) : (
              <div className="divide-y divide-royal-wine/50">
                {rows.map((t) => (
                  <div key={t.key} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-champagne-gold">
                          {t.teamName ?? t.members[0]?.name ?? "—"}
                          {t.teamCode && <span className="ml-2 font-normal tracking-wider text-white/30">{t.teamCode}</span>}
                        </span>
                        <span className="block truncate text-xs text-white/40">
                          {t.members.length} {t.members.length === 1 ? "member" : "members"} ·{" "}
                          {t.members.map((m) => m.name).join(", ")}
                        </span>
                      </span>

                      <span className="rounded-full border border-royal-wine bg-midnight-navy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                        {DISCOVERIZE_STATE_LABEL[t.state]}
                      </span>

                      {!t.abstractSubmittedAt && (
                        <ConfirmAction
                          title="Mark the abstract as received?"
                          description="Use this only when you have the abstract in hand and the form's webhook did not record it — the ticket stops asking for one."
                          confirmLabel="Mark received"
                          onConfirm={() => act(t, "mark_abstract")}
                        >
                          <Button size="sm" variant="subtle" disabled={busy !== null} className="h-8 rounded-lg px-3 text-xs">
                            {busy === t.key + "mark_abstract" ? <Loader2 className="animate-spin" /> : <Check />} Abstract in
                          </Button>
                        </ConfirmAction>
                      )}

                      {t.shortlistedAt ? (
                        <ConfirmAction
                          title={`Take ${t.teamName ?? "this team"} off the shortlist?`}
                          description="The ₹200 comes back off the lead's ticket and they stop being asked to pay. A team that has already paid cannot be taken off this way."
                          confirmLabel="Remove"
                          destructive
                          onConfirm={() => act(t, "unshortlist")}
                        >
                          <Button size="sm" variant="subtle" disabled={busy !== null} className="h-8 rounded-lg px-3 text-xs text-white/70">
                            {busy === t.key + "unshortlist" ? <Loader2 className="animate-spin" /> : <X />} Shortlisted
                          </Button>
                        </ConfirmAction>
                      ) : (
                        <ConfirmAction
                          title={`Shortlist ${t.teamName ?? "this team"}?`}
                          description="They go through to the presentation round, and ₹200 appears on the lead's ticket — for the team, paid once."
                          confirmLabel="Shortlist"
                          onConfirm={() => act(t, "shortlist")}
                        >
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            className="h-8 rounded-lg bg-champagne-gold/90 px-3 text-xs font-semibold text-midnight-navy hover:bg-champagne-gold"
                          >
                            {busy === t.key + "shortlist" ? <Loader2 className="animate-spin" /> : <Star />} Shortlist
                          </Button>
                        </ConfirmAction>
                      )}
                    </div>

                    <p className="text-[11px] text-white/35">
                      Abstract {when(t.abstractSubmittedAt)}
                      {t.shortlistedAt && ` · shortlisted ${when(t.shortlistedAt)}${t.shortlistedBy ? ` by ${t.shortlistedBy}` : ""}`}
                      {t.members[0]?.paymentRef && ` · ref ${t.members.find((m) => m.paymentRef)?.paymentRef}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
