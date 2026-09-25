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

/** One talk inside a workshop strand. */
export type WorkshopSession = {
  time: string;
  person: string;
  /** What they work on — the reason to turn up. */
  expertise: string;
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
          { track: 2, eventId: "bridge-it", label: "Bridge It", host: "Ramaiah Civil Club" },
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
          { track: 4, eventId: "pitch-pulse", label: "Pitch Pulse", host: "IIC", time: "2:00 PM – 8:00 PM" },
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
 * Vidyut Sphura's workshops.
 *
 * They started life as a merged band inside each day, which put them between
 * two track rows and had people reading them as a slot that blocked the
 * events either side. They are not: they run in parallel and anyone can walk
 * into one. Listing them beside the other things that run alongside the
 * tracks says that plainly, and the coordinators asked for exactly that
 * after the first version confused people.
 */
export const workshops: { date: string; club: string; sessions: WorkshopSession[] }[] = [
  {
    date: "14 October",
    club: "Vidyut Sphura",
    sessions: [
      {
        time: "11:00 AM – 12:00 PM",
        person: "Ms. Harita Balan",
        expertise: "Automotive Embedded Systems & Cybersecurity",
      },
      {
        time: "12:00 PM – 1:00 PM",
        person: "Mrs. Rachana K",
        expertise: "ADAS and Autonomous Driving Technologies",
      },
    ],
  },
  {
    date: "15 October",
    club: "Vidyut Sphura",
    sessions: [
      {
        time: "11:00 AM – 1:00 PM",
        person: "Dr. Sanjeev K Nayak",
        expertise: "EV Technologies",
      },
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

/**
 * Minutes past midnight for the sheet's own way of writing a time.
 *
 * The rest of this file deliberately never parses a time — a human reads the
 * string and that is enough. Drawing the grid is the one thing that genuinely
 * needs to compare two of them, so the parsing lives here and nowhere else,
 * and returns NaN rather than guessing at anything it does not recognise.
 */
function minutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return NaN;
  const h = Number(m[1]) % 12;
  return (h + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]);
}

/** The two halves of "2:00 PM – 5:00 PM". En dash, as the sheet writes it. */
function endOf(range: string): number {
  return minutes(range.split("\u2013")[1] ?? "");
}
function startOf(range: string): number {
  return minutes(range.split("\u2013")[0] ?? "");
}

/**
 * How many rows a cell should occupy.
 *
 * An event that outruns its block used to print its longer time and leave the
 * row beneath it empty, which reads as "nothing is on then" — the opposite of
 * what is true. Pitch Pulse runs till 8 and the 5 PM row sat blank under it.
 *
 * Derived from the times rather than written down a second time, so a span
 * and the hours it claims cannot drift apart. It stops at anything that is
 * not a track row: a ceremony or a workshop is a full-width band of its own,
 * and a cell reaching across one would shove it sideways.
 */
export function entryRowSpan(day: ScheduleDay, blockIndex: number, track: TrackEntry["track"]): number {
  const block = day.blocks[blockIndex];
  if (block?.kind !== "tracks") return 1;
  const entry = block.entries.find((e) => e.track === track);
  if (!entry?.time) return 1;

  const runsUntil = endOf(entry.time);
  if (Number.isNaN(runsUntil)) return 1;

  let span = 1;
  for (let i = blockIndex + 1; i < day.blocks.length; i++) {
    const next = day.blocks[i];
    if (next.kind !== "tracks") break;
    const nextStart = startOf(next.time);
    if (Number.isNaN(nextStart) || nextStart >= runsUntil) break;
    /* Somebody else already has this column in that row; the sheet cannot
       mean both, so the span stops rather than swallowing them. */
    if (next.entries.some((e) => e.track === track)) break;
    span += 1;
  }
  return span;
}

/**
 * Beds for people travelling in.
 *
 * On the schedule page because that is where someone works out whether they
 * can get home after a 7:30 PM finish, which is the moment the question
 * actually arises.
 */
export const accommodation = {
  offered: true,
  ratePerHeadPerDay: 450,
  currency: "\u20b9",
  /* Beds are arranged by a person, not a form: whoever is coming from out of
     town has to reach one of these two to book one. Named here rather than
     left in a WhatsApp group so the page can answer the question it raises. */
  contacts: [
    { name: "Rathan Raj", phone: "6363548034" },
    { name: "Shreya", phone: "9606466675" },
  ],
} as const;

/** Every workshop session, flat, for listing and for cross-checking. */
export function workshopSessions(): { date: string; club: string; session: WorkshopSession }[] {
  return workshops.flatMap((w) => w.sessions.map((session) => ({ date: w.date, club: w.club, session })));
}

/** Every event slug the timetable places, for cross-checking against the roster. */
export function scheduledEventIds(): string[] {
  const ids = scheduleDays
    .flatMap((d) => d.blocks)
    .flatMap((b) => (b.kind === "tracks" ? b.entries : []))
    .map((e) => e.eventId)
    .filter((id): id is string => Boolean(id));
  return [...ids, ...longRunning.map((l) => l.eventId)];
}
