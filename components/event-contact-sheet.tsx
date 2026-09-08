"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/lib/identity-context";
import { Event, eventId } from "@/lib/pravrutti-data";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";

/**
 * "Contact the Host" — a question about one event, sent to the fest helpdesk.
 *
 * Rides the existing /api/contact route, which already stores messages in blob
 * storage under `contact/`, rather than adding a second inbox for organisers to
 * remember to check. The only extension was an optional event tag on that
 * route, so a triaging organiser can see which event a question is about.
 *
 * A signed-in visitor gets Luma's single-box composer, because their name and
 * email are already known. A signed-out visitor gets two extra fields instead
 * of a sign-in wall: someone deciding whether to enter at all should be able to
 * ask a question first.
 */
export function EventContactSheet({
  event,
  onClose,
}: {
  event: Event | null;
  onClose: () => void;
}) {
  const me = useIdentity();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const known = me.signedIn && !!me.email;

  // A fresh composer each time, so a sent message never reappears as a draft.
  useEffect(() => {
    if (!event) return;
    setMessage("");
    setName("");
    setEmail("");
    setState("idle");
    setError(null);
  }, [event]);

  const send = async () => {
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: known ? me.name ?? me.email : name,
          email: known ? me.email : email,
          message,
          eventId: event ? eventId(event.name) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn\u2019t send. Check your details and try again.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Your connection dropped. Try sending it again.");
      setState("idle");
    }
  };

  if (!event) return null;

  const ready = message.trim().length >= 5 && (known || (name.trim().length >= 2 && email.includes("@")));

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="p-0 gap-0 flex flex-col overflow-hidden bg-midnight-navy border border-royal-wine text-pearl-white sm:max-w-[520px] sm:rounded-2xl max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
      >
        <div className="flex items-center gap-3 px-3 py-3 border-b border-royal-wine shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close without sending"
            className="w-11 h-11 -my-1 shrink-0 rounded-xl flex items-center justify-center text-pearl-white/60 hover:text-pearl-white hover:bg-cosmic-purple transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-pink"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <DialogTitle className="min-w-0 flex-1 font-orbitron text-sm font-bold uppercase tracking-[0.16em] text-pearl-white truncate">
            Contact the Host
          </DialogTitle>
          {state !== "sent" && (
            <Button
              onClick={send}
              disabled={!ready || state === "sending"}
              className="shrink-0 h-11 px-5 rounded-xl font-orbitron text-xs font-black uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink disabled:opacity-40 cursor-pointer"
            >
              {state === "sending" ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" aria-hidden="true" />
              )}
              {state === "sending" ? "Sending\u2026" : "Send"}
            </Button>
          )}
        </div>

        {state === "sent" ? (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-16 text-center"
            aria-live="polite"
          >
            <CheckCircle2 className="w-10 h-10 text-[#7BE3A8]" aria-hidden="true" />
            <p className="font-orbitron text-sm font-bold text-pearl-white">Question sent</p>
            <p className="font-sharetech text-sm text-pearl-white/60 leading-relaxed">
              The {event.name} team will reply to {known ? me.email : email}. Answers usually take a day or two.
            </p>
            <Button
              onClick={onClose}
              variant="outline"
              className="mt-2 h-11 px-6 rounded-xl border-royal-wine bg-cosmic-purple font-orbitron text-xs font-bold uppercase tracking-widest text-pearl-white/85 hover:bg-deep-plum cursor-pointer"
            >
              Back to event
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain">
            <p className="px-4 pt-4 font-sharetech text-xs text-pearl-white/45">
              About <span className="text-champagne-gold">{event.name}</span>
            </p>

            {!known && (
              <div className="grid sm:grid-cols-2 gap-3 px-4 pt-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  name="name"
                  autoComplete="name"
                  aria-label="Your name"
                  placeholder="Your name…"
                  className="h-12 bg-[#040616] border-royal-wine rounded-xl font-sharetech text-pearl-white placeholder:text-pearl-white/30 focus-visible:ring-cyber-pink"
                />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  aria-label="Your email"
                  placeholder="you@college.edu…"
                  className="h-12 bg-[#040616] border-royal-wine rounded-xl font-sharetech text-pearl-white placeholder:text-pearl-white/30 focus-visible:ring-cyber-pink"
                />
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              aria-label={`Your question about ${event.name}`}
              placeholder={"Please enter your question for the host\u2026"}
              className="flex-1 min-h-[180px] w-full resize-none bg-transparent px-4 py-4 font-sharetech text-base leading-relaxed text-pearl-white placeholder:text-pearl-white/30 focus:outline-none"
            />

            {error && (
              <p
                aria-live="polite"
                className="mx-4 mb-3 rounded-xl border border-cyber-pink/40 bg-cyber-pink/10 p-3 font-sharetech text-xs text-cyber-pink"
              >
                {error}
              </p>
            )}

            <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sharetech text-xs text-pearl-white/35">
              Goes to the fest helpdesk, tagged with this event. Coordinators&rsquo; direct numbers unlock once
              your registration is confirmed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
