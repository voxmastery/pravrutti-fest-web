"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Loader2, Trash2 } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import type { HacktivateDemoLink } from "@/lib/hacktivate-docs";

type State = {
  canSubmit: boolean;
  message: string | null;
  team: { code: string; name: string; status: string } | null;
  demo: HacktivateDemoLink | null;
};

export function HacktivateDocsScreen() {
  const me = useIdentity();
  const [data, setData] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState("");

  const apply = useCallback((json: State) => {
    setData(json);
    setError(null);
    setSignedOut(false);
    if (json.demo?.driveUrl) setDriveUrl(json.demo.driveUrl);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/hacktivate/docs", { cache: "no-store" });
      if (res.status === 401) {
        setSignedOut(true);
        setData(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load your demo link.");
        return;
      }
      apply(json);
    } catch {
      setError("Network dropped. Could not load your demo link.");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!me.ready) return;
    if (!me.signedIn) {
      setLoading(false);
      setSignedOut(true);
      return;
    }
    void refresh();
  }, [me.ready, me.signedIn, refresh]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/hacktivate/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save that link.");
        if ("canSubmit" in json) apply(json);
        return;
      }
      apply(json);
      setNotice(json.message ?? "Demo video link saved.");
    } catch {
      setError("Network dropped. The link was not saved.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/hacktivate/docs", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not remove that link.");
        if ("canSubmit" in json) apply(json);
        return;
      }
      apply(json);
      setDriveUrl("");
      setNotice(json.message ?? "Removed.");
    } catch {
      setError("Network dropped. The link was not removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-24 pt-28 lg:pt-36">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-cyber-pink">
        Hacktivate · Submissions
      </p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-wide sm:text-5xl">
        Demo video
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-pearl-white/65">
        Upload your demo video to Google Drive, set sharing so anyone with the link can view,
        then paste the link here and submit.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/hacktivate/kit" className="text-cyber-pink hover:underline">
          Kit &amp; components
        </Link>
        <span className="text-white/20" aria-hidden="true">
          ·
        </span>
        <Link href="/hacktivate/track" className="text-cyber-pink hover:underline">
          Track pick
        </Link>
        <span className="text-white/20" aria-hidden="true">
          ·
        </span>
        <Link href="/ticket" className="text-cyber-pink hover:underline">
          My ticket
        </Link>
      </div>

      {loading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      )}

      {!loading && signedOut && (
        <div className="mt-10 rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-6">
          <p className="font-semibold text-champagne-gold">Sign in to submit</p>
          <p className="mt-2 text-sm text-white/60">
            Use the Google account on your Hacktivate registration.
          </p>
        </div>
      )}

      {!loading && !signedOut && data && (
        <div className="mt-10 space-y-6">
          {data.team && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              <span className="text-white/45">Team </span>
              <span className="font-semibold text-champagne-gold">{data.team.name}</span>
              <span className="text-white/35"> · {data.team.code}</span>
            </div>
          )}

          {data.message && (
            <div className="rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-3 text-sm text-champagne-gold">
              {data.message}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-soft">
              {notice}
            </div>
          )}

          {data.canSubmit && (
            <form
              onSubmit={(e) => void submit(e)}
              className="rounded-3xl border border-cyber-pink/40 bg-cyber-pink/10 p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-cyber-pink" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-champagne-gold">Google Drive link</p>
                  <p className="mt-1 text-sm text-white/55">
                    One link per team. Submitting again replaces the previous link.
                  </p>
                  <label className="mt-4 block">
                    <span className="sr-only">Google Drive URL</span>
                    <input
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="https://drive.google.com/file/d/…"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      disabled={busy}
                      className="h-12 w-full rounded-2xl border border-white/15 bg-black/30 px-4 text-sm text-pearl-white placeholder:text-white/30 focus:border-cyber-pink focus:outline-none disabled:opacity-50"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={busy || !driveUrl.trim()}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Submit
                    </button>
                    {data.demo && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void clear()}
                        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 px-4 text-sm font-semibold text-white/70 hover:border-danger/50 hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}

          <div className="rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-5 sm:p-6">
            <h2 className="font-display text-xl font-black text-champagne-gold">Submitted link</h2>
            {!data.demo ? (
              <p className="mt-3 text-sm text-white/50">Nothing submitted yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                <a
                  href={data.demo.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 break-all text-sm font-medium text-cyber-pink hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {data.demo.driveUrl}
                </a>
                <p className="text-[12px] text-white/45">
                  {new Date(data.demo.submittedAt).toLocaleString("en-IN")}
                  {data.demo.submittedByName ? ` · ${data.demo.submittedByName}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
