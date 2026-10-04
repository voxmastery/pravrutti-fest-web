import type { Application } from "@/lib/applications";
import { newTicketId } from "@/lib/ticket-id";

/**
 * Registrations taken somewhere else, made into ours.
 *
 * Some events also took entries through Unstop, which collected the fee
 * itself. Those students existed nowhere on our side — not in an event's
 * count, not on the desk at check-in, not on /ticket — so an organiser
 * imports Unstop's export and each entry becomes an ordinary confirmed,
 * paid registration. Two things mark where it came from: `source`, and a
 * payment reference naming the Unstop registration the money went through.
 */

export const EXTERNAL_SOURCES = ["unstop"] as const;
export type ExternalSource = (typeof EXTERNAL_SOURCES)[number];

export type ExternalEntry = {
  externalId?: string;
  teamName?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  college?: string;
  registeredAt?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Indian mobiles as the desk stores them: ten digits, no +91. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^\d{10}$/.test(local) ? local : null;
}

/** Unstop names a solo entrant's team after their username — the part of
    their address before the @ — which is not a team name anyone chose. */
function realTeamName(teamName: string | null | undefined, email: string): string | null {
  const t = String(teamName ?? "").trim();
  if (!t || t.toLowerCase() === email.split("@")[0]) return null;
  return t;
}

export function buildExternalApplication(args: {
  entry: ExternalEntry;
  source: ExternalSource;
  event: { id: string; name: string; fee: string; free: boolean };
  by: string;
  at: string;
}): { application: Application } | { error: string } {
  const { entry, source, event, by, at } = args;
  const email = String(entry.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "No readable email address." };
  const name = String(entry.name ?? "").trim();
  if (!name) return { error: "No name." };
  const phone = normalizePhone(String(entry.phone ?? ""));
  if (!phone) return { error: "No readable 10-digit mobile number." };
  const externalId = String(entry.externalId ?? "").trim();
  if (!externalId) return { error: `No ${source} registration ID.` };

  const registered = Date.parse(String(entry.registeredAt ?? ""));
  const application: Application = {
    ticketId: newTicketId(),
    eventId: event.id,
    eventName: event.name,
    status: "confirmed",
    payment: event.free ? "not_required" : "paid",
    fee: event.free ? "Free" : event.fee,
    name,
    email,
    phone,
    college: String(entry.college ?? "").trim(),
    teamName: realTeamName(entry.teamName, email),
    teamCode: null,
    members: null,
    appliedAt: Number.isFinite(registered) ? new Date(registered).toISOString() : at,
    decidedAt: at,
    paymentRef: `${source.toUpperCase()}-${externalId}`,
    ...(event.free ? {} : { paymentVerifiedAt: at, paymentVerifiedBy: by }),
    source,
    externalId,
  };
  return { application };
}
