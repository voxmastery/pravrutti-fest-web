"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import type { HacktivateDemoLink } from "@/lib/hacktivate-docs";

type Board = {
  role: string;
  actorName: string;
  title: string;
  total: number;
  demos: HacktivateDemoLink[];
};

export function DocsControlScreen() {
  const me = useIdentity();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/hacktivate/docs", { cache: "no-store" });
      if (res.status === 401) {
        setError("Sign in.");
        setBoard(null);
        setForbidden(false);
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        setBoard(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load demo video links.");
        return;
      }
      setError(null);
      setForbidden(false);
      setBoard(json);
    } catch {
      setError("Network dropped. Could not load demo video links.");
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
    }, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return board?.demos ?? [];
    return (board?.demos ?? []).filter((d) =>
      [d.teamName, d.teamCode, d.driveUrl, d.submittedByName, d.submittedByEmail]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [board, query]);

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 pt-28 lg:pt-36">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-cyber-pink">
            Hacktivate · Staff
          </p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-wide sm:text-5xl">
            Demo videos
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pearl-white/65">
            Google Drive links submitted by teams. Visible to fest organisers and Hacktivate
            coordinators.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard" className="text-cyber-pink hover:underline">
            Dashboard
          </Link>
          <Link href="/dashboard/hacktivate/track-pick" className="text-cyber-pink hover:underline">
            Track Pick
          </Link>
        </div>
      </div>

      {loading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      )}

      {!loading && forbidden && (
        <div className="mt-10 rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-6">
          <p className="font-semibold text-champagne-gold">No access</p>
          <p className="mt-2 text-sm text-white/60">
            Demo video links are for Hacktivate organisers and coordinators.
          </p>
        </div>
      )}

      {!loading && error && !forbidden && (
        <div role="alert" className="mt-10 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && board && (
        <div className="mt-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              <span className="font-semibold text-champagne-gold tabular-nums">{board.total}</span>{" "}
              team{board.total === 1 ? "" : "s"} · signed in as {board.actorName}
              {board.title ? ` · ${board.title}` : ""}
            </p>
            <label className="relative block w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team, link, uploader…"
                className="h-10 w-full rounded-2xl border border-white/15 bg-white/[0.04] pl-10 pr-3 text-sm text-pearl-white placeholder:text-white/30 focus:border-cyber-pink focus:outline-none"
              />
            </label>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-6 text-sm text-white/50">
              {board.total === 0
                ? "No teams have submitted a demo video link yet."
                : "No links match that search."}
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((demo) => (
                <li
                  key={demo.teamCode}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-royal-wine bg-cosmic-purple/50 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-champagne-gold">
                      {demo.teamName}{" "}
                      <span className="font-normal text-white/40">· {demo.teamCode}</span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-pearl-white/80">{demo.driveUrl}</p>
                    <p className="mt-0.5 text-[12px] text-white/45">
                      {new Date(demo.submittedAt).toLocaleString("en-IN")} ·{" "}
                      {demo.submittedByName || demo.submittedByEmail}
                    </p>
                  </div>
                  <a
                    href={demo.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-cyber-pink/45 bg-cyber-pink/10 px-4 text-sm font-semibold text-champagne-gold transition-colors hover:border-cyber-pink"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Open Drive
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
