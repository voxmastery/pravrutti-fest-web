import "server-only";

/**
 * The exact hall / lab each event runs in, keyed by event id.
 *
 * Server-only on purpose, for the same reason the coordinators' numbers are
 * (see lib/coordinator-phones.ts). These strings used to sit on `Event.venue`
 * in pravrutti-data.ts, which client components import for the events array —
 * so every hall shipped in the public JS bundle and was baked into the static
 * HTML of all 24 event pages, whatever the UI chose to render.
 *
 * A public site should not publish "which room, at what time, unsupervised"
 * for a campus running combat robots and overnight hackathons. The campus is
 * public (FEST.venue); the room is for people who are actually coming.
 *
 * Reached only through /api/events/coordinators, which hands a hall to a
 * participant the organisers have confirmed, or the event's own staff.
 * Coordinator call numbers on that same route are public; the hall is not.
 *
 * Keyed by event id (the /events/<slug> value). An event with no entry simply
 * has no hall assigned yet and the campus stands in for it everywhere.
 */
const VENUES: Record<string, string> = {
  "robo-race": "GROUND",
  "line-follower": "C BLOCK",
  "kurukshetra-the-robo-war": "Quadrangle",
  "terraform-the-system-awakens": "Classroom",
  "electroxcape": "Labs",
  "discoverize-research-paper-presentation": "Seminar Hall ( A-206)",
  "fault-x-load": "Basketball Court",
  "campus-innovators-2-0": "Seminar Hall (capacity of about 70-90 students)",
  "beyond-the-blueprint-2-0": "Executive Seminar Hall (capacity of about 70-90 students)",
  "respawn": "Classrooms",
  "bridge-it": "Normal Class room",
  "chaos": "Seminar Hall or Lab",
  "hacktivate": "Lab or Workshop",
  "ai-escape-room": "A BLOCK CLASSROOM",
  "bracket-blitz": "cad lab - 3d printing",
  "zero-hour": "A BLOCK 5 classrooms",
  "triathlon": "Seminar Hall / Classroom (Round 1) and Computer Lab (Rounds 2 and 3)",
};

/** The hall for one event, or null when the coordinators haven't named one. */
export const venueFor = (evId: string): string | null => VENUES[evId] ?? null;
