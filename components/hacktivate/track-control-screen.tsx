"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pause, Play, Search } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import { PALETTE } from "@/lib/palette";
import {
  TRACKS,
  TRACK_CAP,
  formatPickClock,
  formatPickTime,
  trackById,
  type BoardRow,
  type StaffBoard,
} from "@/lib/track-pick";
import { downloadTrackCsv, downloadTrackWorkbook, trackPickCsv, trackPickExportRows } from "@/lib/track-pick-export";

type TrackFilter = "all" | "01" | "02" | "03" | "none";
type StatusFilter = "confirmed" | "in_review" | "all";
type SortId = "time" | "team";

const TRACK_FILTERS: { id: TrackFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "01", label: "T1" },
  { id: "02", label: "T2" },
  { id: "03", label: "T3" },
  { id: "none", label: "NOT PICKED" },
];

export function TrackControlScreen() {
  const me = useIdentity();
  const [board, setBoard] = useState<StaffBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");
  const [sort, setSort] = useState<SortId>("time");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<BoardRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/hacktivate/track-pick", { cache: "no-store" });
      if (res.status === 401) {
        setForbidden(false);
        setError("Sign in.");
        setBoard(null);
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        setBoard(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load Track Control.");
        return;
      }
      setError(null);
      setForbidden(false);
      setBoard(json);
    } catch {
      setError("Network dropped. Track Control could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me.ready) return;
    if (!me.signedIn) {
      setLoading(false);
      setError("Sign in.");
      return;
    }
    void load();
  }, [me.ready, me.signedIn, load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows = useMemo(() => filterRows(board?.rows ?? [], { query, trackFilter, statusFilter, sort }), [board, query, trackFilter, statusFilter, sort]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/dashboard/hacktivate/track-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.error ?? "That change was not saved.");
        return;
      }
      setBoard(json);
      setOverrideFor(null);
    } catch {
      setNotice("Network dropped. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const exportName = `hacktivate-track-pick-${new Date().toISOString().slice(0, 10)}`;
  const exportRows = trackPickExportRows(rows);

  if (!me.ready || loading) {
    return (
      <Frame>
        <p aria-busy="true" className="text-white/60">Loading Track Control…</p>
      </Frame>
    );
  }

  if (!me.signedIn) {
    return (
      <Frame>
        <p className="font-semibold">Sign in to open Track Control.</p>
        <button type="button" onClick={() => me.signIn()} className="mt-4 rounded-xl bg-cyber-pink px-4 py-2 text-sm font-semibold">
          Sign in
        </button>
      </Frame>
    );
  }

  if (forbidden) {
    return (
      <Frame>
        <p className="font-semibold">Track Control is for Hacktivate organisers and coordinators.</p>
        <p className="mt-2 text-sm text-white/60">
          Coordinators only see this once their dashboard is switched on in Fest Control.
        </p>
      </Frame>
    );
  }

  if (!board) {
    return (
      <Frame>
        <p>{error ?? "Could not load Track Control."}</p>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="mt-3 text-sm text-champagne-gold underline">
          Try again
        </button>
      </Frame>
    );
  }

  const organiser = board.role === "organiser";

  return (
    <Frame>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <p className="font-display text-[10px] tracking-[0.2em] text-cyber-pink">{organiser ? "ORGANISER" : "COORDINATOR"}</p>
          <p className="mt-1 font-display text-lg font-black">{board.actorName}</p>
          <p className="text-xs leading-snug text-white/50">{board.title}</p>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:flex-col" aria-label="Dashboard">
            <SideLink href="/dashboard">Overview</SideLink>
            {organiser && <SideLink href="/dashboard/applications">Registrations</SideLink>}
            {organiser && <SideLink href="/dashboard/approve">Payments</SideLink>}
            {!organiser && <SideLink href="/dashboard">Teams</SideLink>}
            <SideLink href="/dashboard/hacktivate/track-pick" current>Track Pick</SideLink>
            <SideLink href="/dashboard/scan">Check-in</SideLink>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] tracking-[0.18em] text-cyber-pink">
            {organiser ? "ORGANISER DASHBOARD" : "COORDINATOR DASHBOARD"} · {board.actorName?.toUpperCase()}
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-black">Track Pick Control</h1>
              <p className="text-sm text-white/55">Opened 11 Oct 2026, 09:30 AM IST · first come, first served · live</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${board.paused ? "border-soft-gold/50 text-champagne-gold" : "border-success/40 text-success-soft"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${board.paused ? "bg-soft-gold" : "bg-success"}`} />
                {board.paused ? "PICKING PAUSED" : "PICKING OPEN"}
              </span>
              <button
                type="button"
                data-testid="pause-picking"
                disabled={busy}
                onClick={() => void post({ action: "pause", paused: !board.paused })}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink disabled:opacity-50"
              >
                {board.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {board.paused ? "RESUME PICKING" : "PAUSE PICKING"}
              </button>
              <button
                type="button"
                onClick={() => void downloadTrackWorkbook(exportRows, `${exportName}.xlsx`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-cyber-pink px-3 py-1.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne-gold"
              >
                <Download className="h-3.5 w-3.5" /> EXPORT XLSX
              </button>
              <button
                type="button"
                onClick={() => downloadTrackCsv(trackPickCsv(exportRows), `${exportName}.csv`)}
                className="rounded-full border border-cyber-pink/50 px-3 py-1.5 text-xs text-cyber-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
              >
                CSV
              </button>
            </div>
          </div>

          {notice && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{notice}</p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {board.counts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-royal-wine bg-cosmic-purple/70 p-4">
                <p className="font-display text-[10px] tracking-[0.16em] text-white/45">TRACK_{c.id} · {c.title.toUpperCase()}</p>
                <p className="mt-2 font-display text-3xl font-black tabular-nums">
                  <span className={c.full ? "text-danger" : "text-cyber-pink"}>{c.picked}</span>
                  <span className="text-white/40">/{TRACK_CAP}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${c.full ? "bg-danger" : "bg-gradient-to-r from-cyber-pink to-champagne-gold"}`} style={{ width: `${(c.picked / TRACK_CAP) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/55">
                  {c.full ? `FULL at ${c.fullAt ? formatPickClock(c.fullAt) : ""}` : `${c.left} seats left`}
                </p>
              </div>
            ))}
            <div className="rounded-2xl border border-royal-wine bg-cosmic-purple/70 p-4">
              <p className="font-display text-[10px] tracking-[0.16em] text-white/45">CONFIRMED TEAMS</p>
              <p className="mt-2 font-display text-3xl font-black tabular-nums">
                <span className="text-champagne-gold">{board.pickedTeams}</span>
                <span className="text-white/40">/{board.confirmedTeams}</span>
                <span className="ml-2 text-sm font-semibold text-white/50">picked</span>
              </p>
              <p className="mt-2 text-xs text-white/55">
                {board.notPicked} not picked yet · {board.inReview} in review (no seat)
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search team, lead, or phone</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team, lead, phone…"
                className="h-10 w-full rounded-xl border border-white/10 bg-midnight-navy pl-9 pr-3 text-sm outline-none focus:border-cyber-pink"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by track">
              {TRACK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={trackFilter === f.id}
                  onClick={() => setTrackFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1.5 font-display text-[10px] tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink ${trackFilter === f.id ? "bg-cyber-pink text-white" : "bg-white/5 text-white/60"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="text-xs text-white/50">
              Status{" "}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="ml-1 h-9 rounded-lg border border-white/10 bg-midnight-navy px-2 text-sm text-pearl-white"
              >
                <option value="confirmed">Confirmed</option>
                <option value="in_review">In review</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="text-xs text-white/50">
              Sort{" "}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="ml-1 h-9 rounded-lg border border-white/10 bg-midnight-navy px-2 text-sm text-pearl-white"
              >
                <option value="time">Pick time ↑</option>
                <option value="team">Team name</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-right text-[11px] text-white/40">
            Showing {rows.length} of {board.rows.length} · auto-refresh 5s
          </p>

          <div className="mt-2 max-w-full overflow-x-auto rounded-2xl border border-royal-wine">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] font-display text-[10px] tracking-[0.14em] text-white/40">
                <tr>
                  <th className="px-3 py-2 font-medium">TEAM ID</th>
                  <th className="px-3 py-2 font-medium">TEAM</th>
                  <th className="px-3 py-2 font-medium">LEAD</th>
                  <th className="px-3 py-2 font-medium">PHONE</th>
                  <th className="px-3 py-2 font-medium">TRACK PICKED</th>
                  <th className="px-3 py-2 font-medium">PICK TIME (IST)</th>
                  <th className="px-3 py-2 font-medium">STATUS</th>
                  <th className="px-3 py-2 font-medium">OVERRIDE</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-white/45">No teams match.</td>
                  </tr>
                )}
                {rows.map((row) => {
                  const track = row.trackId ? trackById(row.trackId) : null;
                  return (
                    <tr key={row.teamCode} className="border-t border-white/5">
                      <td className="px-3 py-2.5 font-display text-xs text-white/70">{row.teamCode}</td>
                      <td className="px-3 py-2.5 font-semibold">{row.teamName}</td>
                      <td className="px-3 py-2.5">{row.leadName}</td>
                      <td className="px-3 py-2.5 tabular-nums text-champagne-gold">{row.leadPhone || "—"}</td>
                      <td className="px-3 py-2.5">
                        {track ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${track.id === "01" ? "bg-cyber-pink/20 text-cyber-pink-light" : track.id === "02" ? "bg-success/15 text-success-soft" : "bg-soft-gold/20 text-champagne-gold"}`}>
                            T{Number(track.id)} · {track.title}
                          </span>
                        ) : (
                          <span className="text-xs text-white/35">NOT PICKED</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-white/70">{row.pickedAt ? formatPickClock(row.pickedAt) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${row.status === "confirmed" ? "bg-success/15 text-success-soft" : "bg-soft-gold/15 text-champagne-gold"}`}>
                          {row.status === "confirmed" ? "CONFIRMED" : row.status === "in_review" ? "IN REVIEW" : "OTHER"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.trackId ? (
                          <button
                            type="button"
                            onClick={() => { setNotice(null); setOverrideFor(row); }}
                            className="text-xs text-champagne-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
                          >
                            Move / undo
                          </button>
                        ) : (
                          <span className="text-xs text-white/25">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="mt-6">
            <h2 className="font-display text-sm font-bold tracking-wide">Override log</h2>
            {board.audit.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">No moves or undos yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {board.audit.map((a) => (
                  <li key={a.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    <span className="text-champagne-gold">{a.actorName}</span>
                    {" "}
                    {a.action === "undo"
                      ? `undid ${a.teamCode} (was Track ${a.fromTrack}, seat ${a.fromSeat})`
                      : `moved ${a.teamCode} from Track ${a.fromTrack} to Track ${a.toTrack}`}
                    <span className="text-white/45"> · {formatPickTime(a.at)}</span>
                    <p className="text-white/70">Reason: {a.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 text-xs leading-relaxed text-white/40">
            {organiser
              ? "Access: organiser. Picks are final for teams. An override (move or undo) is logged with your name and a reason."
              : "Access: Hacktivate coordinator. Picks are final for teams. An override (move or undo) is logged with your name and a reason."}
          </p>
        </div>
      </div>

      {overrideFor && (
        <OverrideDialog
          row={overrideFor}
          busy={busy}
          counts={board.counts}
          onClose={() => setOverrideFor(null)}
          onSubmit={(action, reason, trackId) =>
            void post(action === "undo"
              ? { action: "undo", teamCode: overrideFor.teamCode, reason }
              : { action: "move", teamCode: overrideFor.teamCode, trackId, reason })
          }
        />
      )}
    </Frame>
  );
}

function filterRows(rows: BoardRow[], opts: { query: string; trackFilter: TrackFilter; statusFilter: StatusFilter; sort: SortId }) {
  const q = opts.query.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (opts.statusFilter === "confirmed" && r.status !== "confirmed") return false;
    if (opts.statusFilter === "in_review" && r.status !== "in_review") return false;
    if (opts.trackFilter === "none" && r.trackId) return false;
    if (opts.trackFilter !== "all" && opts.trackFilter !== "none" && r.trackId !== opts.trackFilter) return false;
    if (!q) return true;
    return [r.teamCode, r.teamName, r.leadName, r.leadEmail, r.leadPhone].join(" ").toLowerCase().includes(q);
  });
  out = [...out].sort((a, b) => {
    if (opts.sort === "team") return a.teamName.localeCompare(b.teamName);
    if (!a.pickedAt && !b.pickedAt) return a.teamCode.localeCompare(b.teamCode);
    if (!a.pickedAt) return 1;
    if (!b.pickedAt) return -1;
    return a.pickedAt.localeCompare(b.pickedAt);
  });
  return out;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-pearl-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: `linear-gradient(to right, ${PALETTE.royalWine}44 1px, transparent 1px), linear-gradient(to bottom, ${PALETTE.royalWine}44 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-16 pt-28 sm:px-6">{children}</div>
    </div>
  );
}

function SideLink({ href, children, current = false }: { href: string; children: React.ReactNode; current?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink ${current ? "bg-cyber-pink/20 text-pearl-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

function OverrideDialog({
  row,
  busy,
  counts,
  onClose,
  onSubmit,
}: {
  row: BoardRow;
  busy: boolean;
  counts: StaffBoard["counts"];
  onClose: () => void;
  onSubmit: (action: "move" | "undo", reason: string, trackId: string) => void;
}) {
  const [mode, setMode] = useState<"move" | "undo">("move");
  const [trackId, setTrackId] = useState(TRACKS.find((t) => t.id !== row.trackId)?.id ?? "02");
  const [reason, setReason] = useState("");
  const destFull = counts.find((c) => c.id === trackId)?.full;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="override-title">
      <form
        className="w-full max-w-md rounded-2xl border border-royal-wine bg-deep-plum p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(mode, reason, trackId);
        }}
      >
        <h2 id="override-title" className="font-display text-lg font-black">Override {row.teamName}</h2>
        <p className="mt-1 text-sm text-white/60">This is stored with your name. Teams cannot undo it themselves.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" aria-pressed={mode === "move"} onClick={() => setMode("move")} className={`rounded-lg px-3 py-1.5 text-xs ${mode === "move" ? "bg-cyber-pink text-white" : "bg-white/5"}`}>Move</button>
          <button type="button" aria-pressed={mode === "undo"} onClick={() => setMode("undo")} className={`rounded-lg px-3 py-1.5 text-xs ${mode === "undo" ? "bg-cyber-pink text-white" : "bg-white/5"}`}>Undo pick</button>
        </div>
        {mode === "move" && (
          <label className="mt-4 block text-sm">
            Move to
            <select value={trackId} onChange={(e) => setTrackId(e.target.value as typeof trackId)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-midnight-navy px-2">
              {TRACKS.filter((t) => t.id !== row.trackId).map((t) => (
                <option key={t.id} value={t.id}>Track {t.id} · {t.title}</option>
              ))}
            </select>
            {destFull && <span className="mt-1 block text-xs text-danger">That track is full.</span>}
          </label>
        )}
        <label className="mt-4 block text-sm">
          Reason
          <textarea
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-midnight-navy px-2 py-2 text-sm outline-none focus:border-cyber-pink"
            placeholder="Why this team is being moved or undone"
          />
        </label>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-white/60">Cancel</button>
          <button type="submit" disabled={busy || reason.trim().length < 3 || (mode === "move" && !!destFull)} className="rounded-xl bg-cyber-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "Saving…" : "Save override"}
          </button>
        </div>
      </form>
    </div>
  );
}
