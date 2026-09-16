import type { AppStatus, PayStatus } from "@/lib/applications";

/** The four visual tones a status badge can take. Mapped to Badge variants. */
export type Tone = "success" | "warning" | "neutral" | "danger";
export type ToneLabel = { tone: Tone; label: string };

const APP: Record<AppStatus, ToneLabel> = {
  pending: { tone: "warning", label: "In review" },
  confirmed: { tone: "success", label: "Confirmed" },
  declined: { tone: "neutral", label: "Declined" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

const PAY: Record<PayStatus, ToneLabel> = {
  not_required: { tone: "neutral", label: "No payment" },
  awaiting: { tone: "warning", label: "Payment due" },
  paid: { tone: "success", label: "Paid" },
  refunded: { tone: "neutral", label: "Refunded" },
};

/* A value outside the known set (an older record, a seeded row, a typo in
   storage) must still produce a visible badge — an empty pill with an
   `undefined` class is what this replaces. */
const UNKNOWN: ToneLabel = { tone: "neutral", label: "Unknown" };

export const appStatusTone = (s: string | null | undefined): ToneLabel =>
  (s && (APP as Record<string, ToneLabel>)[s]) || UNKNOWN;

export const payStatusTone = (s: string | null | undefined): ToneLabel =>
  (s && (PAY as Record<string, ToneLabel>)[s]) || UNKNOWN;
