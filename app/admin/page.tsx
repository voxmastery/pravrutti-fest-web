"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { events, eventId, capacityFor } from "@/lib/pravrutti-data";
import { Application, AppStatus } from "@/lib/applications";
import { Loader2, Download, Lock, RefreshCw, Mail, Check, X, IndianRupee } from "lucide-react";

type Contact = { name: string; email: string; message: string; sentAt: string };
type Tab = AppStatus | "contacts";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "In review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
  { id: "contacts", label: "Messages" },
];

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [filter, setFilter] = useState("all");

  const load = async (k = key) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin", { headers: { "x-admin-key": k } });
      if (res.status === 401) {
        setError("That key didn't work.");
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setApps(data.applications ?? []);
      setContacts(data.contacts ?? []);
      setAuthed(true);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const act = async (a: Application, action: "confirm" | "decline" | "mark_paid") => {
    const tag = `${a.eventId}:${a.email}:${action}`;
    setBusy(tag);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ action, eventId: a.eventId, email: a.email }),
      });
      const data = await res.json();
      if (res.ok && data.application) {
        setApps((prev) =>
          prev.map((x) => (x.eventId === a.eventId && x.email === a.email ? data.application : x))
        );
      } else {
        setError(data.error ?? "That action didn't go through.");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const byStatus = (s: AppStatus) => apps.filter((a) => a.status === s);
  const source = tab === "contacts" ? [] : byStatus(tab as AppStatus);
  const shown = filter === "all" ? source : source.filter((a) => a.eventId === filter);

  const perEvent = events
    .map((e) => {
      const id = eventId(e.name);
      const list = apps.filter((a) => a.eventId === id);
      return {
        id,
        name: e.name,
        cap: capacityFor(id),
        pending: list.filter((a) => a.status === "pending").length,
        confirmed: list.filter((a) => a.status === "confirmed").length,
        total: list.length,
      };
    })
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  const exportCsv = () => {
    const head = ["ticketId", "event", "status", "payment", "fee", "name", "email", "phone", "college", "teamName", "members", "appliedAt"];
    const rows = shown.map((r) =>
      [r.ticketId, r.eventName, r.status, r.payment, r.fee, r.name, r.email, r.phone, r.college, r.teamName ?? "", r.members ?? "", r.appliedAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pravrutti-${tab}-${filter}.csv`;
    a.click();
  };

  const refundsDue = apps.filter((a) => a.status === "declined" && a.payment === "refunded" && a.fee.toLowerCase() !== "free");

  if (!authed) {
    return (
      <main className="min-h-screen bg-transparent text-[#F7EEE4] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 p-8 border border-[#4A1C3A] rounded-3xl bg-[#150B1E]/60">
          <div className="flex items-center gap-2 font-orbitron font-black uppercase tracking-wider text-[#F2D2AE]">
            <Lock className="w-5 h-5 text-[#D64D8D]" /> Admin console
          </div>
          <Input
            type="password"
            placeholder="Admin key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="bg-[#040616] border-[#4A1C3A] rounded-xl text-[#F7EEE4] font-mono"
          />
          {error && <p className="text-xs text-[#D64D8D] font-sharetech">{error}</p>}
          <Button
            onClick={() => load()}
            disabled={loading || !key}
            className="w-full rounded-xl bg-[#D64D8D] hover:bg-[#AC355D] text-white font-orbitron text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter"}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-[#F7EEE4] p-6 md:p-10 font-sharetech">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-orbitron font-black text-2xl uppercase tracking-wider text-[#F2D2AE]">
            Pravrutti admin
          </h1>
          <div className="flex gap-2">
            <Button onClick={() => load()} disabled={loading} variant="outline" className="rounded-xl border-[#4A1C3A] text-xs cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button onClick={exportCsv} className="rounded-xl bg-[#D64D8D] hover:bg-[#AC355D] text-white text-xs font-bold cursor-pointer">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-[#D64D8D] border border-[#D64D8D]/40 bg-[#D64D8D]/10 rounded-xl p-3">{error}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "In review", value: byStatus("pending").length },
            { label: "Confirmed", value: byStatus("confirmed").length },
            { label: "Refunds to issue", value: refundsDue.length },
            { label: "Messages", value: contacts.length },
          ].map((s) => (
            <div key={s.label} className="p-4 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/60">
              <p className="text-[10px] uppercase tracking-widest text-[#F7EEE4]/50">{s.label}</p>
              <p className="font-orbitron font-black text-xl text-[#F2D2AE] mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.id}
              onClick={() => setTab(t.id)}
              variant={tab === t.id ? "default" : "outline"}
              className={`rounded-xl text-xs cursor-pointer ${tab === t.id ? "bg-[#D64D8D] text-white" : "border-[#4A1C3A]"}`}
            >
              {t.id === "contacts" && <Mail className="w-4 h-4 mr-1" />}
              {t.label} ({t.id === "contacts" ? contacts.length : byStatus(t.id as AppStatus).length})
            </Button>
          ))}
          {tab !== "contacts" && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ml-auto bg-[#040616] border border-[#4A1C3A] rounded-xl text-xs px-3 py-2 text-[#F7EEE4]"
            >
              <option value="all">All events</option>
              {perEvent.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.confirmed}/{e.cap} confirmed, {e.pending} waiting
                </option>
              ))}
            </select>
          )}
        </div>

        {tab !== "contacts" ? (
          <div className="space-y-3">
            {shown.map((a) => {
              const cap = capacityFor(a.eventId);
              const confirmedForEvent = apps.filter((x) => x.eventId === a.eventId && x.status === "confirmed").length;
              const wouldOverfill = a.status === "pending" && confirmedForEvent >= cap;
              return (
                <div key={a.ticketId} className="border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/50 p-4 flex flex-wrap gap-4 items-center">
                  <div className="min-w-[180px] flex-1">
                    <p className="font-bold text-sm text-[#F7EEE4]">{a.name}</p>
                    <p className="text-xs text-[#F7EEE4]/50">{a.email} · {a.phone}</p>
                    <p className="text-xs text-[#F7EEE4]/40">{a.college}{a.teamName ? ` · team ${a.teamName}` : ""}</p>
                  </div>
                  <div className="min-w-[150px]">
                    <p className="text-xs font-bold text-[#F2D2AE]">{a.eventName}</p>
                    <p className="text-[10px] font-mono text-[#D64D8D]">{a.ticketId}</p>
                    <p className="text-[10px] text-[#F7EEE4]/40">
                      {confirmedForEvent}/{cap} confirmed
                    </p>
                  </div>
                  <div className="min-w-[110px]">
                    <span
                      className={`text-[10px] font-orbitron font-black uppercase tracking-wider px-2 py-1 rounded-full border ${
                        a.payment === "paid"
                          ? "bg-[#D64D8D]/15 border-[#D64D8D]/40 text-[#D64D8D]"
                          : a.payment === "refunded"
                          ? "bg-[#4A1C3A]/40 border-[#4A1C3A] text-[#F7EEE4]/60"
                          : a.payment === "awaiting"
                          ? "bg-[#BF8A1B]/15 border-[#BF8A1B]/40 text-[#BF8A1B]"
                          : "bg-transparent border-[#4A1C3A] text-[#F7EEE4]/45"
                      }`}
                    >
                      {a.payment === "not_required" ? "Free" : a.payment === "awaiting" ? `${a.fee} due` : a.payment}
                    </span>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    {a.payment === "awaiting" && (
                      <Button
                        onClick={() => act(a, "mark_paid")}
                        disabled={busy?.startsWith(`${a.eventId}:${a.email}`)}
                        variant="outline"
                        className="rounded-xl h-9 text-[10px] border-[#BF8A1B]/50 text-[#BF8A1B] hover:bg-[#BF8A1B]/10 font-bold uppercase cursor-pointer"
                      >
                        <IndianRupee className="w-3 h-3 mr-1" /> Mark paid
                      </Button>
                    )}
                    {a.status !== "confirmed" && (
                      <Button
                        onClick={() => act(a, "confirm")}
                        disabled={busy?.startsWith(`${a.eventId}:${a.email}`)}
                        title={wouldOverfill ? "This event is already at capacity" : undefined}
                        className={`rounded-xl h-9 text-[10px] font-bold uppercase cursor-pointer text-white ${
                          wouldOverfill ? "bg-[#BF8A1B] hover:bg-[#a4750f]" : "bg-[#D64D8D] hover:bg-[#AC355D]"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> {wouldOverfill ? "Confirm anyway" : "Confirm"}
                      </Button>
                    )}
                    {a.status !== "declined" && (
                      <Button
                        onClick={() => act(a, "decline")}
                        disabled={busy?.startsWith(`${a.eventId}:${a.email}`)}
                        variant="outline"
                        className="rounded-xl h-9 text-[10px] border-[#4A1C3A] text-[#F7EEE4]/70 hover:bg-[#4A1C3A]/30 font-bold uppercase cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Decline{a.fee.toLowerCase() !== "free" ? " + refund" : ""}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!shown.length && (
              <div className="p-10 text-center text-[#F7EEE4]/40 border border-dashed border-[#4A1C3A] rounded-2xl text-sm">
                Nothing here yet
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="p-4 border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/40">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-bold text-[#F2D2AE]">{c.name} · {c.email}</span>
                  <span className="text-[#F7EEE4]/40">{new Date(c.sentAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-[#F7EEE4]/80 whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
            {!contacts.length && <p className="p-8 text-center text-[#F7EEE4]/40 text-sm">No messages yet</p>}
          </div>
        )}
      </div>
    </main>
  );
}
