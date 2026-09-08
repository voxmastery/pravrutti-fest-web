"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "bg-midnight-navy border-royal-wine rounded-xl text-pearl-white placeholder:text-pearl-white/30 focus-visible:ring-cyber-pink";

  const submit = async () => {
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
        setState("idle");
      } else {
        setState("sent");
      }
    } catch {
      setError("Network error — try again");
      setState("idle");
    }
  };

  return (
    <div className="p-8 border border-royal-wine rounded-3xl bg-cosmic-purple/60 backdrop-blur-md cyber-box max-w-2xl mx-auto">
      <h3 className="text-xl font-extrabold font-display text-pearl-white tracking-wide mb-1">Send a Transmission</h3>
      <p className="text-xs text-cyber-pink uppercase tracking-widest font-bold mb-6">Direct Message</p>

      {state === "sent" ? (
        <div className="text-center py-8 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-champagne-gold mx-auto" />
          <p className="text-pearl-white/80">Message received. The helpdesk crew will get back to you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Input className={inputCls} placeholder="Your name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input className={inputCls} type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <Textarea
            className={inputCls + " min-h-[110px]"}
            placeholder="Your message *" value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
          {error && (
            <p className="text-xs text-cyber-pink border border-cyber-pink/40 bg-cyber-pink/10 rounded-xl p-3">{error}</p>
          )}
          <Button
            onClick={submit}
            disabled={state === "sending"}
            className="w-full rounded-xl h-11 text-xs font-display font-bold uppercase tracking-widest text-white arcade-btn-magenta border-cyber-pink cursor-pointer" >
            {state === "sending" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Transmit
          </Button>
        </div>
      )}
    </div>
  );
}
