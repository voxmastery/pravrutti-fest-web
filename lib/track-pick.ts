import type { Role } from "@/lib/roles";

/**
 * Hacktivate 2026 track pick.
 *
 * Track copy lives in `TRACKS` and only there. To rename Track 1, change
 * `title` (the big name) and `theme` (the line under it). The card, the
 * confirm dialog, the success card and Track Control all read this list.
 *
 * Opening instant: 10:00 AM IST on 11 Oct 2026. Override with
 * `TRACK_PICK_OPENS_AT` (ISO-8601, e.g. `2026-10-11T04:30:00.000Z` or
 * `2026-10-11T10:00:00+05:30`). A value that does not parse is ignored and
 * the official instant is used — a typo must not open picking early.
 * The server reads this on every request. Restart the app after changing it.
 */

export const HACKTIVATE_EVENT_ID = "hacktivate";

/** 10:00 AM IST on 11 Oct 2026. */
export const TRACK_PICK_OPEN_UTC = "2026-10-11T04:30:00.000Z";

export const TRACK_CAP = 20;
export const HOLD_MS = 2000;

export type TrackId = "01" | "02" | "03";

export type TrackDef = {
  id: TrackId;
  /** Big name on the card. Change this to rename the track. */
  title: string;
  /** Line under the title. Empty string hides it. */
  theme: string;
  /** One or two sentences under the theme. */
  summary: string;
  tags: readonly string[];
  /** Shown when the problem statement is not published yet. Null hides it. */
  problemNote: string | null;
  pdfHref: string | null;
};

/** The component rule, word for word, on the Track 1 card and the success line. */
export const OWN_COMPONENTS_RULE =
  "Teams may bring and use their own components. A PCB Cupid kit is available on site for Track 1 (Seconds Ahead).";

export const TRACKS: readonly TrackDef[] = [
  {
    id: "01",
    title: "Seconds Ahead",
    theme: "Predict road dangers before they happen, for a road user you are yourself.",
    summary: OWN_COMPONENTS_RULE,
    tags: ["Kit available", "Hardware"],
    problemNote: null,
    pdfHref: "/hacktivate/challenges/seconds-ahead.pdf",
  },
  {
    id: "02",
    title: "ElevenLabs x Seeed Studio",
    theme: "Voice That Sets People Free",
    summary:
      "Predictive voice + assistive hardware for someone who depends on others today. Voice is the core here (ElevenLabs credits are for every track).",
    tags: ["Bring own hardware", "Voice-first track", "Voice + AI"],
    problemNote: null,
    pdfHref: "/hacktivate/challenges/voice-that-sets-people-free.pdf",
  },
  {
    id: "03",
    title: "Open Hardware",
    theme: "Predict Anything",
    summary: "Any predictive system: a home, a company, a factory, a city.",
    tags: ["Bring own hardware", "Open theme", "Prediction"],
    problemNote: null,
    pdfHref: "/hacktivate/challenges/predict-anything.pdf",
  },
];

export const ELEVENLABS_BANNER = {
  title: "ElevenLabs Creator plan for all participants",
  body: "Every participant in every track gets it. Use voice AI in any track and you're eligible for the Best Voice AI Build (reSpeaker, from Seeed Studio).",
} as const;

/**
 * Shown on the success card for every track.
 * Track 1 repeats the component rule so the on-site kit is not read as mandatory.
 */
export function componentsReadyLine(trackId: string): string {
  const n = Number(trackId);
  const label = Number.isFinite(n) && n > 0 ? String(n) : trackId;
  if (label === "1") return `Track 1/3: ${OWN_COMPONENTS_RULE}`;
  return `Track ${label}/3: get your components ready before the event.`;
}

export const SUCCESS_SURPRISES = "// surprises waiting 👀";
export const CONFIRM_FINAL = "This is final. No changes after you lock in.";

export function trackById(id: string | null | undefined): TrackDef | null {
  return TRACKS.find((t) => t.id === id) ?? null;
}

export function isTrackId(id: string): id is TrackId {
  return TRACKS.some((t) => t.id === id);
}

/** "Seconds Ahead: Predict road dangers before they happen…" */
export function trackFullName(track: Pick<TrackDef, "title" | "theme">): string {
  const theme = track.theme.trim();
  return theme ? `${track.title}: ${theme}` : track.title;
}

/** The sentence the Track 1 card has to communicate, built from config. */
export function trackCardLabel(track: TrackDef): string {
  const name = trackFullName(track);
  const summary = track.summary.trim();
  return summary ? `Track ${track.id} · ${name}. ${summary}` : `Track ${track.id} · ${name}`;
}

export function fullTrackMessage(trackId: string): string {
  return `Sorry, Track ${trackId} just filled. Another team grabbed the last seat while you were confirming. Your pick was not saved. Please pick another track.`;
}

export function trackPickOpensAt(env?: { TRACK_PICK_OPENS_AT?: string | undefined }): number {
  const raw = (env ?? process.env).TRACK_PICK_OPENS_AT?.trim();
  if (raw) {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return Date.parse(TRACK_PICK_OPEN_UTC);
}

export function pickingIsOpen(now: number, opensAt: number): boolean {
  return now >= opensAt;
}

export function countdownParts(now: number, opensAt: number) {
  const totalMs = Math.max(0, opensAt - now);
  const total = Math.floor(totalMs / 1000);
  const hrs = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hrs: pad(hrs), min: pad(min), sec: pad(sec), done: totalMs <= 0, totalMs };
}

const istParts = (isoOrMs: string | number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", ...options }).formatToParts(new Date(isoOrMs));

const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((p) => p.type === type)?.value ?? "";

/** "11 Oct · 09:30:42 IST" */
export function formatPickTime(iso: string): string {
  const parts = istParts(iso, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${part(parts, "day")} ${part(parts, "month")} · ${part(parts, "hour")}:${part(parts, "minute")}:${part(parts, "second")} IST`;
}

/** "09:30:42" for the dense staff table. */
export function formatPickClock(iso: string): string {
  const parts = istParts(iso, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${part(parts, "hour")}:${part(parts, "minute")}:${part(parts, "second")}`;
}

export function formatOpensAt(ms: number): string {
  const parts = istParts(ms, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  });
  const day = part(parts, "day");
  const month = part(parts, "month");
  const year = part(parts, "year");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute");
  const dayPeriod = part(parts, "dayPeriod").toUpperCase();
  return `${day} ${month} ${year} · ${hour}:${minute} ${dayPeriod} IST`;
}

export type TeamStanding = "confirmed" | "in_review" | "closed";

export type ViewerFacts = {
  email: string;
  team: null | {
    code: string;
    name: string;
    leadEmail: string;
    leadName: string;
    status: TeamStanding;
  };
  /** Signed-in person leads this team and still holds a live registration. */
  isLead: boolean;
  /** Their own Hacktivate registration is still pending or confirmed. */
  viewerLive: boolean;
};

export type ScreenId =
  | "signed_out"
  | "no_team"
  | "ineligible"
  | "member"
  | "countdown"
  | "paused"
  | "picker"
  | "locked";

export type GateInput = {
  facts: ViewerFacts;
  now: number;
  opensAt: number;
  paused: boolean;
  picked: boolean;
};

export type GateDecision = {
  screen: ScreenId;
  canPick: boolean;
  message: string | null;
};

export const COPY = {
  noTeamTitle: "No Hacktivate team on this email",
  noTeam: "Track pick follows the team your lead registered. Sign in with that Google account, or ask your lead to use theirs.",
  ineligibleTitle: "Not eligible for track pick",
  ineligible:
    "Track pick is only open to confirmed teams. All 60 seats are reserved for confirmed teams, so teams still in review won't get a seat this time.",
  ineligibleHelp: "Questions? Reach out to the organisers.",
  notLead: "Only your team lead can pick.",
  notOpen: "Picking is not open yet.",
  paused: "Picking is paused. It opens again when the organisers resume it.",
  alreadyPicked: "Your team already locked a track. Picks are final.",
  signIn: "Sign in with the Google account your team registered.",
} as const;

/**
 * What this person is allowed to see and do. Checked again on the server
 * at the moment of the pick — the screen is not the permission.
 *
 * Order: team, then confirmed, then already picked (so a teammate sees the
 * locked card), then lead, then the clock, then pause.
 */
export function gate(input: GateInput): GateDecision {
  const { facts, now, opensAt, paused, picked } = input;
  if (!facts.team || !facts.viewerLive) {
    return { screen: "no_team", canPick: false, message: COPY.noTeam };
  }
  if (facts.team.status !== "confirmed") {
    return { screen: "ineligible", canPick: false, message: COPY.ineligible };
  }
  if (picked) {
    return { screen: "locked", canPick: false, message: null };
  }
  if (!facts.isLead) {
    return { screen: "member", canPick: false, message: COPY.notLead };
  }
  if (!pickingIsOpen(now, opensAt)) {
    return { screen: "countdown", canPick: false, message: COPY.notOpen };
  }
  if (paused) {
    return { screen: "paused", canPick: false, message: COPY.paused };
  }
  return { screen: "picker", canPick: true, message: null };
}

export function canManageTrackPick(role: { kind: string; eventIds?: readonly string[] } | Role): boolean {
  if (role.kind === "organiser") return true;
  if (role.kind === "coordinator") return (role.eventIds ?? []).includes(HACKTIVATE_EVENT_ID);
  return false;
}

/** Titles for the Track Control sidebar. Unknown coordinators get a plain label. */
export const COORDINATOR_TITLES: Record<string, string> = {
  "shravanth.polisetty@gmail.com": "IEEE SB Vice Chair · Hacktivate coordinator",
};

export const ORGANISER_NAMES: Record<string, string> = {
  "voxmastery@gmail.com": "Ganesh",
};

export function staffTitle(email: string, kind: "organiser" | "coordinator"): string {
  if (kind === "organiser") return "Fest control";
  return COORDINATOR_TITLES[email.trim().toLowerCase()] ?? "Hacktivate coordinator";
}

export function knownStaffName(email: string): string | null {
  const who = email.trim().toLowerCase();
  return ORGANISER_NAMES[who] ?? (who === "shravanth.polisetty@gmail.com" ? "Shravanth" : null);
}

/** What the participant page receives. Counts only — never another team's name. */
export type PublicTrack = TrackDef & {
  picked: number;
  left: number;
  full: boolean;
  nextSeat: number | null;
};

export type PublicPick = {
  trackId: string;
  seat: number;
  pickedAt: string;
  trackTitle: string;
  trackName: string;
};

export type ParticipantState = {
  screen: ScreenId;
  canPick: boolean;
  message: string | null;
  paused: boolean;
  open: boolean;
  opensAt: string;
  serverNow: string;
  viewer: { email: string; isLead: boolean };
  team: ViewerFacts["team"];
  tracks: PublicTrack[];
  pick: PublicPick | null;
};

export type BoardRow = {
  teamCode: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  status: TeamStanding | "other";
  trackId: string | null;
  seat: number | null;
  pickedAt: string | null;
};

export type TrackCount = {
  id: string;
  title: string;
  picked: number;
  left: number;
  full: boolean;
  fullAt: string | null;
};

export type StaffAudit = {
  id: number;
  teamCode: string;
  action: "move" | "undo";
  fromTrack: string | null;
  toTrack: string | null;
  fromSeat: number | null;
  toSeat: number | null;
  actorEmail: string;
  actorName: string;
  reason: string;
  at: string;
};

export type StaffBoard = {
  role?: "organiser" | "coordinator";
  actorName?: string;
  actorEmail?: string;
  title?: string;
  paused: boolean;
  pausedBy: string | null;
  pausedAt: string | null;
  counts: TrackCount[];
  confirmedTeams: number;
  pickedTeams: number;
  notPicked: number;
  inReview: number;
  rows: BoardRow[];
  audit: StaffAudit[];
  serverNow: string;
};
