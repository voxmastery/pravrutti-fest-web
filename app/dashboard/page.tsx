"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { useIdentity } from "@/lib/identity-context";
import { useDashboardRole } from "@/hooks/use-dashboard-role";
import { AlertTriangle, Check } from "lucide-react";

type Counts = { registered: number; confirmed: number; checkedIn: number; notArrived: number };
/** Contact fields arrive only for organisers — see the event route. */
type Entry = {
  name: string;
  college: string;
  status: string;
  checkedInAt: string | null;
  email?: string;
  phone?: string;
  teamName?: string | null;
  members?: string | null;
  payment?: string;
  appliedAt?: string;
  paymentVerifiedBy?: string | null;
  paymentVerifiedAt?: string | null;
};

type Row = {
  eventId: string;
  name: string;
  category: string;
  venue: string | null;
  capacity: number | null;
  registered: number;
  confirmed: number;
  checkedIn: number;
  fill: number | null;
};
type Overview = {
  phase: "before" | "during" | "after";
  totals: { registered: number; confirmed: number; checkedIn: number; capacity: number };
  events: Row[];
};

type Sort = "fill" | "name" | "registered";

export default function DashboardPage() {
  const me = useIdentity();
  const dash = useDashboardRole();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [sort, setSort] = useState<Sort>("fill");
  const [open, setOpen] = useState<string | null>(null);

  // Organisers land on the fest overview; a coordinator goes straight to
  // their event, because with one or two events an overview is a detour.
  useEffect(() => {
    if (!dash.ready) return;
    if (dash.role === "organiser") {
      fetch("/api/dashboard/overview")
        .then((r) => (r.ok ? r.json() : null))
        .then(setOverview)
        .catch(() => setOverview(null));
    } else if (dash.role === "coordinator" && dash.events.length > 0) {
      setOpen(dash.events[0].eventId);
    }
  }, [dash.ready, dash.role, dash.events]);

  if (me.ready && !me.signedIn) return <Shell><p className="text-white/60">Sign in to view your event.</p></Shell>;
  if (!dash.ready) return <Shell><p className="text-white/50">Loading…</p></Shell>;

  if (dash.role === "none")
    return (
      <Shell>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
          <p className="font-semibold mb-1.5">No dashboard access</p>
          <p className="text-sm text-white/50">
            This account isn&apos;t listed as a coordinator for any event. Contact the
            organising team if that looks wrong.
          </p>
        </div>
      </Shell>
    );

  // ── Coordinator: their roster, no overview ──────────────────────────────
  if (dash.role === "coordinator") {
    return (
      <Shell title={dash.events.length > 1 ? "My events" : "My event"}>
        {dash.events.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {dash.events.map((e) => (
              <button
                key={e.eventId}
                onClick={() => setOpen(e.eventId)}
                className={`rounded-full px-4 py-2 text-sm border transition-colors ${
                  open === e.eventId
                    ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                    : "bg-white/[0.04] text-white/70 border-white/[0.12] hover:border-white/25"
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
        {open && <EventDetail eventId={open} />}
      </Shell>
    );
  }

  // ── Organiser: the whole fest ───────────────────────────────────────────
  if (!overview) return <Shell title="Fest control"><p className="text-white/50">Loading…</p></Shell>;

  const { totals, phase } = overview;
  const during = phase === "during" || phase === "after";

  // The headline answers the question the organiser actually has right now:
  // before the fest, how full are we; during it, who has turned up.
  const headline = during
    ? { n: totals.checkedIn, of: totals.confirmed, label: "arrived", sub: "of confirmed registrations" }
    : { n: totals.registered, of: totals.capacity, label: "places filled", sub: "across all 24 arenas" };

  const pct = headline.of > 0 ? Math.round((headline.n / headline.of) * 100) : 0;

  const rows = [...overview.events].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "registered") return b.registered - a.registered;
    return (a.fill ?? 2) - (b.fill ?? 2); // emptiest first — those need action
  });

  return (
    <Shell title="Fest control" wide>
      {/* One number, largest thing on the page. A dashboard whose primary
          metric can't be found in five seconds has no hierarchy — and this
          page previously led with a wall of 24 navigation chips. */}
      <div className="rounded-3xl border border-[#4A1C3A] bg-gradient-to-br from-[#2B122C]/70 via-[#150B1E]/80 to-[#0A0818] p-6 sm:p-8 mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#D64D8D] mb-3">
          {during ? "Check-in progress" : "Registration"}
        </p>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="font-orbitron text-5xl sm:text-6xl font-black text-[#F2D2AE] leading-none tabular-nums">
            {headline.n.toLocaleString("en-IN")}
          </span>
          <span className="font-ui text-xl text-white/45 tabular-nums pb-1">
            / {headline.of.toLocaleString("en-IN")} {headline.label}
          </span>
        </div>
        <p className="font-ui text-sm text-white/45 mt-1">{headline.sub}</p>

        <div className="mt-5 h-2 rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D64D8D] to-[#F2D2AE] transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-ui text-sm">
          <Stat label="Registered" v={totals.registered} />
          <Stat label="Confirmed" v={totals.confirmed} />
          <Stat label="Checked in" v={totals.checkedIn} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="font-orbitron font-black text-lg text-[#F7EEE4]">All events</h2>
        <div className="flex gap-1.5">
          {(["fill", "registered", "name"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-ui border transition-colors ${
                sort === s
                  ? "bg-[#721F4C]/40 text-[#F2D2AE] border-[#D64D8D]/50"
                  : "bg-white/[0.03] text-white/50 border-white/[0.08] hover:text-white/80"
              }`}
            >
              {s === "fill" ? "Emptiest first" : s === "registered" ? "Most signups" : "A–Z"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#4A1C3A]/70 bg-[#150B1E]/40 divide-y divide-[#4A1C3A]/50 overflow-hidden">
        {rows.map((r) => (
          <EventRow key={r.eventId} r={r} open={open === r.eventId} onToggle={() => setOpen(open === r.eventId ? null : r.eventId)} />
        ))}
      </div>
    </Shell>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <span>
      <span className="block text-white/40 text-xs">{label}</span>
      <span className="block font-semibold text-[#F7EEE4] tabular-nums">{v.toLocaleString("en-IN")}</span>
    </span>
  );
}

/** A row is its own summary — the fill bar means "which need attention" is
    answerable by scanning, without opening anything. */
function EventRow({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  const pct = r.fill === null ? null : Math.round(r.fill * 100);
  // Only flagged while there is still time to act on it.
  const empty = r.capacity !== null && r.registered / r.capacity < 0.25;
  const full = r.capacity !== null && r.registered >= r.capacity;

  const bar = full ? "bg-[#F87171]" : empty ? "bg-[#BF8A1B]" : "bg-[#D64D8D]";

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full text-left px-4 py-3.5 flex items-center gap-4 transition-colors ${
          open ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-ui font-semibold text-[#F7EEE4] truncate">{r.name}</span>
            {(empty || full) && (
              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${full ? "text-[#F87171]" : "text-[#BF8A1B]"}`} />
            )}
          </span>
          <span className="block font-ui text-sm text-white/40 truncate">
            {r.venue ?? "Venue TBC"}
          </span>
        </span>

        <span className="hidden sm:block w-28 shrink-0">
          {pct !== null ? (
            <>
              <span className="block h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </span>
              <span className="block mt-1 text-[11px] text-white/35 tabular-nums">{pct}% full</span>
            </>
          ) : (
            <span className="block text-[11px] text-white/25">No cap set</span>
          )}
        </span>

        <span className="shrink-0 text-right font-ui tabular-nums w-24">
          <span className="block font-semibold text-[#F7EEE4]">
            {r.registered}
            {r.capacity !== null && <span className="text-white/35 font-normal"> / {r.capacity}</span>}
          </span>
          <span className="block text-[11px] text-white/40">{r.checkedIn} in</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white/[0.02]">
          <EventDetail eventId={r.eventId} />
        </div>
      )}
    </div>
  );
}

/** The single-event roster, shared by both roles. */
function EventDetail({ eventId }: { eventId: string }) {
  const [data, setData] = useState<{ counts: Counts; roster: Entry[] } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  // Bumped after a verification so the counts and status re-read from the
  // server rather than being patched locally and drifting out of step.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setState("loading");
    fetch(`/api/dashboard/event/${eventId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => { if (!cancelled) { setData(d); setState("ok"); } })
      .catch(() => { if (!cancelled) { setData(null); setState("error"); } });
    return () => { cancelled = true; };
  }, [eventId, tick]);

  if (state === "loading") return <p className="text-white/45 text-sm py-5">Loading roster…</p>;

  if (state === "error")
    return (
      <div className="rounded-2xl border border-[#F87171]/30 bg-[#F87171]/[0.06] p-5 mt-3">
        <p className="font-semibold mb-1">Couldn&apos;t load this roster</p>
        <p className="text-sm text-white/60">
          The registration store didn&apos;t respond. Your access is fine — this is a problem
          at our end.
        </p>
      </div>
    );

  if (!data) return null;

  return (
    <div className="pt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3 font-ui text-sm">
        <Stat label="Registered" v={data.counts.registered} />
        <Stat label="Confirmed" v={data.counts.confirmed} />
        <Stat label="Checked in" v={data.counts.checkedIn} />
        <Stat label="Not arrived" v={data.counts.notArrived} />
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#0A0818]/60 divide-y divide-white/[0.05] max-h-[380px] overflow-y-auto">
        {data.roster.length === 0 ? (
          <p className="p-5 text-sm text-white/45">No registrations yet.</p>
        ) : (
          data.roster.map((p, i) => (
            <Participant key={i} p={p} eventId={eventId} onChanged={() => setTick((t) => t + 1)} />
          ))
        )}
      </div>
      {/* Only true for coordinators now; organisers see them inline. */}
      {data.roster.length > 0 && data.roster[0].email === undefined && (
        <p className="mt-2 text-xs text-white/30">Contact details are held by the organising team.</p>
      )}
    </div>
  );
}

/**
 * One roster line. For an organiser the name is a button that opens the
 * person's contact details; for a coordinator no contact fields arrive, so it
 * stays a plain row rather than an affordance that leads nowhere.
 */
function Participant({
  p,
  eventId,
  onChanged,
}: {
  p: Entry;
  eventId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasDetail = p.email !== undefined;
  const paid = p.payment === "paid";

  const setPaid = async (verified: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/dashboard/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: p.email, verified }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  const team = (() => {
    if (!p.members) return null;
    try {
      const parsed = JSON.parse(p.members);
      if (Array.isArray(parsed))
        return parsed.map((m: { name?: string; phone?: string }) =>
          [m.name, m.phone].filter(Boolean).join(" · ")
        );
    } catch {
      // Older records stored a comma-separated string.
      return p.members.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return null;
  })();

  const status = p.checkedInAt ? (
    <>
      <span className="block text-[#7BE3A8]">Checked in</span>
      <span className="block text-xs text-white/35 tabular-nums">
        {new Date(p.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </>
  ) : p.status === "confirmed" ? (
    <span className="text-white/45">Not arrived</span>
  ) : (
    <span className={p.status === "declined" ? "text-white/30" : "text-[#F2D2AE]"}>
      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
    </span>
  );

  const row = (
    <>
      <span className="min-w-0 text-left">
        <span className={`block text-sm font-medium truncate ${hasDetail ? "text-[#F2D2AE]" : "text-[#F7EEE4]"}`}>
          {p.name}
        </span>
        <span className="block text-sm text-white/40 truncate">{p.college}</span>
      </span>
      <span className="text-sm shrink-0 text-right">{status}</span>
    </>
  );

  if (!hasDetail)
    return <div className="flex items-center justify-between gap-4 px-4 py-2.5">{row}</div>;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-4 px-4 py-2.5 transition-colors ${
          open ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
        }`}
      >
        {row}
      </button>

      {open && (
        <dl className="px-4 pb-3 pt-1 bg-white/[0.03] text-sm space-y-1.5">
          <Detail k="Email">
            <a href={`mailto:${p.email}`} className="text-[#F2D2AE] hover:underline break-all">
              {p.email}
            </a>
          </Detail>
          <Detail k="Phone">
            {/* tel: so it dials straight from the phone an organiser is holding. */}
            <a href={`tel:${p.phone}`} className="text-[#F2D2AE] hover:underline">
              {p.phone}
            </a>
          </Detail>
          {p.teamName && <Detail k="Team">{p.teamName}</Detail>}
          {team && team.length > 0 && (
            <Detail k="Members">
              <span className="block space-y-0.5">
                {team.map((m, i) => (
                  <span key={i} className="block text-white/70">{m}</span>
                ))}
              </span>
            </Detail>
          )}
          {p.appliedAt && (
            <Detail k="Applied">
              {new Date(p.appliedAt).toLocaleDateString([], { day: "numeric", month: "short" })}
            </Detail>
          )}

          {/* Payment is an action, not a label — an organiser checks the money
              arrived elsewhere, then records that here. Shows who verified it,
              which a shared password never could. */}
          <div className="flex gap-3 pt-1.5">
            <dt className="w-20 shrink-0 text-white/35">Payment</dt>
            <dd className="min-w-0 flex-1">
              {paid ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-[#7BE3A8]">
                    <Check className="w-3.5 h-3.5" /> Verified
                  </span>
                  {p.paymentVerifiedBy && (
                    <span className="text-xs text-white/35">
                      by {p.paymentVerifiedBy}
                      {p.paymentVerifiedAt &&
                        ` \u00b7 ${new Date(p.paymentVerifiedAt).toLocaleDateString([], { day: "numeric", month: "short" })}`}
                    </span>
                  )}
                  <button
                    onClick={() => setPaid(false)}
                    disabled={busy}
                    className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 disabled:opacity-40"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[#F2D2AE]">{(p.payment ?? "awaiting").replace(/_/g, " ")}</span>
                  <button
                    onClick={() => setPaid(true)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#12B76A]/15 border border-[#12B76A]/45 text-[#7BE3A8] px-3 h-8 text-xs font-semibold hover:bg-[#12B76A]/25 disabled:opacity-40 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {busy ? "Saving\u2026" : "Mark payment verified"}
                  </button>
                  {p.status === "pending" && (
                    <span className="text-xs text-white/35">also confirms them</span>
                  )}
                </div>
              )}
              {err && <p className="mt-1 text-xs text-[#F87171]">{err}</p>}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Detail({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-white/35">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Shell({ title = "Dashboard", wide = false, children }: { title?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-transparent text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />
      <div className={`relative z-10 flex-1 w-full ${wide ? "max-w-[1100px]" : "max-w-[900px]"} mx-auto px-6 py-28 font-ui`}>
        <h1 className="font-orbitron text-3xl font-black mb-6">{title}</h1>
        {children}
      </div>
    </main>
  );
}
