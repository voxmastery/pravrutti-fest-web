"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useIdentity } from "@/lib/identity-context";
import { CERTIFICATE_QUESTIONS, parseCertificateAnswers } from "@/lib/certificate-questions";

/**
 * One control on My Tickets. It renders nothing until the server says this
 * signed-in person checked in (themselves, or via their team lead). The
 * download never sends a name — the PDF is built from their registration.
 */
export function CertificateActions({ className }: { className?: string }) {
  const me = useIdentity();
  const [eligible, setEligible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me.ready || !me.signedIn) {
      setEligible(false);
      setReady(me.ready);
      return;
    }
    let cancel = false;
    setReady(false);
    fetch("/api/certificate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancel || !data) return;
        setEligible(data.eligible === true);
        setSubmitted(data.submitted === true);
      })
      .catch(() => {
        if (!cancel) setEligible(false);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [me.ready, me.signedIn]);

  const download = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/certificate/download");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Couldn't download the certificate.");
        return;
      }
      const blob = await res.blob();
      const header = res.headers.get("Content-Disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(header);
      const filename = decodeURIComponent((match?.[1] || match?.[2] || "Pravrutti2.0_Certificate.pdf").trim());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseCertificateAnswers(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: parsed.answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't save your feedback.");
        setBusy(false);
        return;
      }
      setSubmitted(true);
      setOpen(false);
      setBusy(false);
      await download();
    } catch {
      setError("Network dropped. Try again.");
      setBusy(false);
    }
  }

  if (!ready || !eligible) return null;

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={() => (submitted ? void download() : setOpen(true))}
        disabled={busy}
        className="h-[34px] rounded-2xl bg-white text-black hover:bg-white/90 font-medium text-sm px-4 cursor-pointer"
      >
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Award className="mr-1.5 h-4 w-4" />
        )}
        Generate certificate
      </Button>
      {error && !open && <p className="mt-2 text-center text-xs text-cyber-pink">{error}</p>}

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-h-[min(92vh,760px)] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-cosmic-purple/95 text-white backdrop-blur-xl sm:max-w-lg">
          <DialogTitle className="pr-6 font-display text-lg font-black tracking-wide text-pearl-white">
            Before your certificate
          </DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            A few questions about Pravrutti 2.0. Your certificate downloads once they&apos;re in, and you can download it again later without filling this in.
          </DialogDescription>
          <form onSubmit={onSubmit} className="space-y-4">
            {CERTIFICATE_QUESTIONS.map((question) => (
              <fieldset key={question.id} className="min-w-0 space-y-2">
                <legend className="text-sm leading-snug text-white/85">
                  {question.prompt}
                  {question.required && (
                    <span className="text-cyber-pink" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  )}
                </legend>
                {question.kind === "choice" ? (
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const selected = values[question.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setValues((current) => ({ ...current, [question.id]: option.value }))}
                          className={
                            selected
                              ? "cursor-pointer rounded-full border border-white bg-white px-3 py-1.5 text-sm font-medium text-black"
                              : "cursor-pointer rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : question.kind === "paragraph" ? (
                  <textarea
                    value={values[question.id] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [question.id]: event.target.value }))}
                    placeholder={question.placeholder}
                    maxLength={question.maxLength}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
                  />
                ) : (
                  <input
                    value={values[question.id] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [question.id]: event.target.value }))}
                    placeholder={question.placeholder}
                    maxLength={question.maxLength}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
                  />
                )}
              </fieldset>
            ))}
            {error && open && <p className="text-xs text-cyber-pink">{error}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="h-10 w-full cursor-pointer rounded-2xl bg-white text-sm font-medium text-black hover:bg-white/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit and download"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
