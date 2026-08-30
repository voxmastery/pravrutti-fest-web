"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { useIdentity } from "@/lib/identity-context";

type Ev = { eventId: string; name: string };
type Counts = { registered: number; confirmed: number; checkedIn: number; notArrived: number };
type Entry = { name: string; college: string; status: string; checkedInAt: string | null };

export default function DashboardPage() {
  const me = useIdentity();
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const [role, setRole] = useState<string>("none");
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<{ counts: Counts; roster: Entry[] } | null>(null);

  useEffect(() => {
    if (!me.signedIn) return;
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role);
        setEvs(d.events);
        if (d.events.length > 0) setActive(d.events[0].eventId);
      })
      .catch(() => setEvs([]));
  }, [me.signedIn]);

  useEffect(() => {
    if (!active) return;
    // Guard against a fetch race: if the user switches tabs before this
    // request resolves, React runs this cleanup (setting `cancelled`) before
    // starting the next effect for the new `active`. A late response for an
    // event we've since navigated away from is then dropped instead of
    // overwriting the newer selection's counts/roster with stale data.
    let cancelled = false;
    setData(null);
    fetch(`/api/dashboard/event/${active}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <main className="relative min-h-screen bg-transparent text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />
      <div className="relative z-10 flex-1 w-full max-w-[900px] mx-auto px-6 py-28 font-ui">
        <h1 className="font-orbitron text-3xl font-black mb-6">Event dashboard</h1>

        {!me.ready ? null : !me.signedIn ? (
          <p className="text-white/60">Sign in to view your event.</p>
        ) : evs === null ? (
          <p className="text-white/60">Loading…</p>
        ) : evs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
            <p className="font-semibold mb-1.5">No dashboard access</p>
            <p className="text-sm text-white/50">
              This account isn&apos;t listed as a coordinator for any event. Contact
              the organising team if that looks wrong.
            </p>
          </div>
        ) : (
          <>
            {evs.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {evs.map((e) => (
                  <button
                    key={e.eventId}
                    onClick={() => setActive(e.eventId)}
                    className={`rounded-full px-4 py-2 text-sm font-medium border ${
                      active === e.eventId
                        ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                        : "bg-white/[0.04] text-white/70 border-white/[0.1]"
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            )}

            {data && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {([
                    ["Registered", data.counts.registered],
                    ["Confirmed", data.counts.confirmed],
                    ["Checked in", data.counts.checkedIn],
                    ["Not arrived", data.counts.notArrived],
                  ] as const).map(([label, n]) => (
                    <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <p className="text-sm text-white/50">{label}</p>
                      <p className="font-orbitron text-2xl font-black">{n}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] overflow-hidden">
                  {data.roster.length === 0 ? (
                    <p className="p-6 text-sm text-white/50">No registrations yet.</p>
                  ) : (
                    data.roster.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.06] last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-sm text-white/45 truncate">{p.college}</p>
                        </div>
                        <span className="text-sm shrink-0">
                          {p.checkedInAt ? (
                            <span className="text-[#7BE3A8]">Checked in</span>
                          ) : p.status === "confirmed" ? (
                            <span className="text-white/45">Not arrived</span>
                          ) : (
                            <span className="text-[#F2D2AE]">{p.status}</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {role === "coordinator" && (
                  <p className="text-xs text-white/35 mt-4">
                    Contact details are held by the organising team.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      <FooterSection />
    </main>
  );
}
