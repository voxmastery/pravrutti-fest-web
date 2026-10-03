import "server-only";

/**
 * Coordinator phone numbers, keyed by event id.
 *
 * Server-only on purpose. These used to live inline in pravrutti-data.ts, which
 * several client components import for the events array — that put all 48
 * numbers into the public JS bundle, where anyone could scrape them. The gate
 * on the UI was cosmetic until they moved here. The "server-only" import makes
 * a client import a build error rather than a quiet leak.
 *
 * Reached only through /api/events/coordinators. Call buttons are public, so
 * that route returns them for any valid event slug — including signed-out
 * visitors — without putting the numbers back into pravrutti-data.ts.
 *
 * Keyed by event id (the /events/<slug> value) and matched to the public
 * coordinator list by name, so a name edited in pravrutti-data.ts must be
 * edited here too or that person's call button quietly stops appearing.
 */
export type CoordinatorPhone = { name: string; phone: string };

const PHONES: Record<string, CoordinatorPhone[]> = {
  "robo-race": [
    { name: "A R BHARAATH", phone: "7259513381" },
    { name: "JOSHIKA S", phone: "9611367397" },
  ],
  "line-follower": [
    { name: "SHASHANK", phone: "9449913019" },
    { name: "JOSHIKA S", phone: "9611367397" },
  ],
  "kurukshetra-the-robo-war": [
    { name: "A R BHARAATH", phone: "7259513381" },
    { name: "RATHAN", phone: "6363548034" },
  ],
  "terraform-the-system-awakens": [
    { name: "Sambal Agarwal", phone: "7307430193" },
    { name: "Radhe S,", phone: "9686138774" },
  ],
  "electroxcape": [
    { name: "Sachin R Shenoy", phone: "9353539822" },
    { name: "Megha H", phone: "8867365326" },
  ],
  "discoverize-research-paper-presentation": [
    { name: "Aaliyah Aijaz Ali Khan", phone: "8197092607" },
    { name: "Gnaneshwari N", phone: "7829004057" },
  ],
  "fault-x-load": [
    { name: "Bhauthik V", phone: "9742385315" },
    { name: "Vimal Kanth", phone: "6361245327" },
  ],
  "pitch-pulse": [
    { name: "Kiran Kumar BM", phone: "9164644099" },
    { name: "Jeslene Iniya D", phone: "8148817683" },
  ],
  "campus-innovators-2-0": [
    { name: "Akshay", phone: "9686226622" },
    { name: "Nikhita", phone: "9380268311" },
  ],
  "beyond-the-blueprint-2-0": [
    { name: "Akshy P M", phone: "9686226622" },
    { name: "Nikhita", phone: "9380268311" },
  ],
  "respawn": [
    { name: "Jeslene Iniya D", phone: "8148817683" },
    { name: "Sooraj Chakravarthy S", phone: "63602 69253" },
  ],
  "glide-x": [
    { name: "B S Mokshada", phone: "93538 24957" },
    { name: "Siddharth P", phone: "70223 95629" },
  ],
  "the-logic-circuit": [
    { name: "Spandana J S", phone: "6364220817" },
    { name: "Dhvani Viroja", phone: "8460357383" },
  ],
  "rc-x": [
    { name: "Shravya T", phone: "99948 35916" },
    { name: "Pranav P J", phone: "95677 34887" },
  ],
  "leads-innovation-challenge": [
    { name: "Pranav Bansal", phone: "7483160806" },
    { name: "Siddharth Gupta", phone: "8102116082" },
  ],
  "dent-innovate": [
    { name: "Ankush Chadichal", phone: "8073411261" },
    { name: "Abhilashree B Hosmani", phone: "7975965514" },
  ],
  "pitch-at-mach": [
    { name: "Ankith A Joshi", phone: "8217684051" },
    { name: "Afifa Fatima Karigar", phone: "9741698766" },
  ],
  "bridge-it": [
    { name: "Abhilash N M", phone: "8618488065" },
    { name: "Rajeshwari", phone: "9019328888" },
  ],
  "chaos": [
    { name: "Ganesh", phone: "7975324769" },
    { name: "Shravanth", phone: "6363860239" },
  ],
  "hacktivate": [
    { name: "Shravanth", phone: "6363860239" },
  ],
  "ai-escape-room": [
    { name: "Madhumitha A", phone: "9025678951" },
    { name: "N Anushka", phone: "9606853110" },
  ],
  "bracket-blitz": [
    { name: "Pradeep Raj M", phone: "9025329551" },
    { name: "Suman A", phone: "6364519267" },
  ],
  "zero-hour": [
    { name: "Sudeepa Priyadarshini", phone: "9900964418" },
    { name: "Tanya Shedde", phone: "7483573793" },
  ],
  "hammer": [
    { name: "Hrithik A", phone: "9686505558" },
    { name: "L Mahadeva Balan", phone: "8147197853" },
  ],
  "triathlon": [
    { name: "Aman Tebriwal", phone: "62046 75554" },
    { name: "Sneha", phone: "73558 82325" },
  ],
};

/** Numbers for one event, or [] when none are on file. */
export const coordinatorPhones = (evId: string): CoordinatorPhone[] => PHONES[evId] ?? [];

/** Looks up one coordinator's number by name, for pairing with public data. */
export function phoneFor(evId: string, name: string): string | null {
  const hit = coordinatorPhones(evId).find((c) => c.name === name);
  return hit?.phone ?? null;
}
