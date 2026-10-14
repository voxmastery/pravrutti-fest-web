"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { useIdentity } from "@/lib/identity-context";
import { formatDocSize, type HacktivateDocMeta } from "@/lib/hacktivate-docs";

type State = {
  canUpload: boolean;
  message: string | null;
  team: { code: string; name: string; status: string } | null;
  docs: HacktivateDocMeta[];
  maxPerTeam: number;
  maxBytes: number;
};

export function HacktivateDocsScreen() {
  const me = useIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback((json: State) => {
    setData(json);
    setError(null);
    setSignedOut(false);
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
        setError(json.error ?? "Could not load uploads.");
        return;
      }
      apply(json);
    } catch {
      setError("Network dropped. Could not load uploads.");
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

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/hacktivate/docs", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        if (json.docs) apply(json);
        return;
      }
      apply(json);
      setNotice(`Uploaded ${json.doc?.fileName ?? file.name}.`);
    } catch {
      setError("Network dropped. The PDF was not uploaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/hacktivate/docs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not remove that PDF.");
        if (json.docs) apply(json);
        return;
      }
      apply(json);
      setNotice("Removed.");
    } catch {
      setError("Network dropped. That PDF was not removed.");
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
        Schematics &amp; screenshots
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-pearl-white/65">
        Upload a PDF of your schematics, board photos, or screen captures for the organisers.
        PDF only · up to 8&nbsp;MB · max {data?.maxPerTeam ?? 5} files per team.
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
          <p className="font-semibold text-champagne-gold">Sign in to upload</p>
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

          {data.canUpload && (
            <div className="rounded-3xl border border-cyber-pink/40 bg-cyber-pink/10 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-cyber-pink" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-champagne-gold">Upload a PDF</p>
                  <p className="mt-1 text-sm text-white/55">
                    Schematics, annotated screenshots, wiring diagrams — one PDF at a time.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    disabled={busy || data.docs.length >= data.maxPerTeam}
                    onClick={() => inputRef.current?.click()}
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Choose PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-royal-wine bg-cosmic-purple/50 p-5 sm:p-6">
            <h2 className="font-display text-xl font-black text-champagne-gold">
              Your team&apos;s PDFs
              <span className="ml-2 text-sm font-normal text-white/40">
                {data.docs.length}/{data.maxPerTeam}
              </span>
            </h2>
            {data.docs.length === 0 ? (
              <p className="mt-3 text-sm text-white/50">Nothing uploaded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-pearl-white">{doc.fileName}</p>
                      <p className="mt-0.5 text-[12px] text-white/45">
                        {formatDocSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleString("en-IN")}
                        {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                      </p>
                    </div>
                    {data.canUpload && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(doc.id)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white/60 hover:border-danger/50 hover:text-danger disabled:opacity-40"
                        aria-label={`Remove ${doc.fileName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
