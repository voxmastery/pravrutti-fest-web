/**
 * The three-day timetable, as the coordinators' sheet gives it.
 *
 * Kept as data rather than an image. The previous schedule on this site WAS an
 * image, and it silently showed the 2025 roster long after the events changed —
 * a wrong schedule is worse than none, because it reads as authoritative. As
 * data it is diffable, links to the real event pages, reads on a phone, and is
 * checked against the event list by test/schedule.test.ts.
 *
 * Times are written exactly as the sheet writes them; nothing is parsed into a
 * Date, because the only consumer is a human reading a row.
 */

export type TrackEntry = {
  /** 1-4, the column in the coordinators' sheet. */
  track: 1 | 2 | 3 | 4;
  /** Slug of one of our events, when it is one. */
  eventId?: string;
  /** What to print. Also the fallback for anything without an event page. */
  label: string;
  /** Club or department running it, as the sheet names them. */
  host?: string;
  /** Set only when this entry runs longer than its block — a merged cell in
      the sheet, e.g. HAMMER spanning 9:00 AM to 3:00 PM. */
  time?: string;
};

export type ScheduleBlock =
  | { kind: "banner"; time: string; label: string }
  | { kind: "tracks"; time: string; entries: TrackEntry[] };

export type ScheduleDay = {
  n: 1 | 2 | 3;
  date: string;
  blocks: ScheduleBlock[];
};

export const scheduleDays: ScheduleDay[] = [
  {
    n: 1,
    date: "14 October 2026",
    blocks: [
      { kind: "banner", time: "9:00 AM – 11:00 AM", label: "Inauguration" },
      {
        kind: "tracks",
        time: "11:00 AM – 2:00 PM",
        entries: [
          { track: 1, eventId: "ai-escape-room", label: "AI Escape Room", host: "AI Club" },
          { track: 2, eventId: "bridge-it", label: "Bridge It", host: "Civil Club" },
          { track: 3, eventId: "leads-innovation-challenge", label: "LEADS Innovation Challenge", host: "LEADS" },
          { track: 4, eventId: "triathlon", label: "Triathlon", host: "Cynergy" },
        ],
      },
      {
        kind: "tracks",
        time: "2:00 PM – 5:00 PM",
        entries: [
          { track: 1, eventId: "pitch-at-mach", label: "Pitch at Mach", host: "AeSI" },
          { track: 2, eventId: "discoverize-research-paper-presentation", label: "Discoverize — Research Paper", host: "ISTE" },
          { track: 3, eventId: "dent-innovate", label: "Dent Innovate", host: "IIC" },
          /* Not one of the 24 events on this site — no page to link to. */
          { track: 4, label: "Pitch Pulse", host: "IIC", time: "2:00 PM – 8:00 PM" },
        ],
      },
      {
        kind: "tracks",
        time: "5:00 PM – 8:00 PM",
        entries: [
          { track: 1, eventId: "line-follower", label: "Line Follower", host: "Robotics" },
          { track: 2, eventId: "fault-x-load", label: "Fault x Load", host: "IMechE" },
        ],
      },
    ],
  },
  {
    n: 2,
    date: "15 October 2026",
    blocks: [
      {
        kind: "tracks",
        time: "9:00 AM – 12:00 PM",
        entries: [
          { track: 1, eventId: "the-logic-circuit", label: "The Logic Circuit", host: "Math Club" },
          { track: 2, eventId: "robo-race", label: "Robo Race", host: "Robotics" },
          { track: 3, eventId: "rc-x", label: "RC-X", host: "Aeronyx" },
          { track: 4, eventId: "hammer", label: "Hammer", host: "Cynergy", time: "9:00 AM – 3:00 PM" },
        ],
      },
      {
        kind: "tracks",
        time: "12:00 PM – 3:00 PM",
        entries: [
          { track: 1, eventId: "terraform-the-system-awakens", label: "Terraform", host: "AI Club" },
          { track: 2, eventId: "beyond-the-blueprint-2-0", label: "Beyond the Blueprint", host: "TSS" },
          { track: 3, eventId: "zero-hour", label: "Zero Hour", host: "Cynergy" },
        ],
      },
      { kind: "banner", time: "3:00 PM – 7:00 PM", label: "Under25" },
    ],
  },
  {
    n: 3,
    date: "16 October 2026",
    blocks: [
      {
        kind: "tracks",
        time: "9:00 AM – 12:00 PM",
        entries: [
          { track: 1, eventId: "respawn", label: "Respawn", host: "ComputeX" },
          { track: 2, eventId: "campus-innovators-2-0", label: "Campus Innovators", host: "TSS" },
          { track: 3, eventId: "glide-x", label: "Glide-X", host: "Aeronyx" },
          { track: 4, eventId: "kurukshetra-the-robo-war", label: "Kurukshetra", host: "Robotics", time: "9:00 AM – 3:00 PM" },
        ],
      },
      {
        kind: "tracks",
        time: "12:00 PM – 3:00 PM",
        entries: [
          { track: 1, eventId: "electroxcape", label: "ElectroXcape", host: "Circuitopia" },
          { track: 2, eventId: "bracket-blitz", label: "Bracket Blitz", host: "ASME" },
        ],
      },
      { kind: "banner", time: "3:00 PM – 5:00 PM", label: "Valedictory Ceremony" },
    ],
  },
];

/**
 * Events that do not sit in a track because they run across or through the
 * day — the sheet lists them in their own block at the bottom.
 */
export const longRunning: { date: string; time: string; eventId: string; label: string; host: string }[] = [
  {
    date: "14 October",
    time: "11:00 AM – 11:00 AM (next day)",
    eventId: "hacktivate",
    label: "Hacktivate",
    host: "IEEE",
  },
  {
    date: "15 October",
    time: "11:30 AM – 7:30 PM",
    eventId: "chaos",
    label: "Chaos",
    host: "IEEE",
  },
];

/** Every event slug the timetable places, for cross-checking against the roster. */
export function scheduledEventIds(): string[] {
  const ids = scheduleDays
    .flatMap((d) => d.blocks)
    .flatMap((b) => (b.kind === "tracks" ? b.entries : []))
    .map((e) => e.eventId)
    .filter((id): id is string => Boolean(id));
  return [...ids, ...longRunning.map((l) => l.eventId)];
}
