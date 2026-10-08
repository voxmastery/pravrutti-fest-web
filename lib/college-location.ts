import { COVERED_BY_LEAD } from "@/lib/applications";

/**
 * Where a registration sits, for the organiser desk.
 *
 * College is a free-text field. There is no city or state column, so the
 * bucket is derived from that string and nothing else. The lists below are
 * the mapping: a name that matches none of them is Unknown, on purpose, so a
 * new spelling is visible instead of being dropped into a nearby state.
 *
 * Order is the rule. The first list that matches wins, which is why a
 * Mangaluru college that also wrote "Bangalore" on a city campus is caught
 * by the Bengaluru words before the Karnataka list, and why "PES College of
 * Engineering" (Mandya) is caught before the PES University rule.
 */

export type LocationBucket = "bengaluru" | "karnataka" | "outside" | "unknown";

export const LOCATION_BUCKETS: { id: LocationBucket; label: string }[] = [
  { id: "bengaluru", label: "Bengaluru colleges" },
  { id: "karnataka", label: "Karnataka, outside Bengaluru" },
  { id: "outside", label: "Outside Karnataka" },
  { id: "unknown", label: "Unknown" },
];

export const locationLabel = (id: LocationBucket) =>
  LOCATION_BUCKETS.find((b) => b.id === id)?.label ?? "Unknown";

/** Confirmed or still in review, and not a refunded fee. */
export function holdsLocationPlace(a: { status?: string | null; payment?: string | null }): boolean {
  return (a.status === "pending" || a.status === "confirmed") && a.payment !== "refunded";
}

const TYPOS: [RegExp, string][] = [
  [/\bbanglore\b/g, "bangalore"],
  [/\bbangaluru\b/g, "bengaluru"],
  [/\bbangalur\b/g, "bengaluru"],
  [/\bbangluru\b/g, "bengaluru"],
  [/\bmanglore\b/g, "mangalore"],
  [/\bmangaluru\b/g, "mangalore"],
  [/\bcollage\b/g, "college"],
  [/\buniveristy\b/g, "university"],
  [/\bunivevrsity\b/g, "university"],
  [/\buinversity\b/g, "university"],
  [/\bengeering\b/g, "engineering"],
  [/\benginerring\b/g, "engineering"],
  [/\binstitue\b/g, "institute"],
  [/\bistitute\b/g, "institute"],
  [/\binsitute\b/g, "institute"],
  [/\bmanagemenet\b/g, "management"],
  [/\badhichunchangiri\b/g, "adichunchanagiri"],
  [/\bramiah\b/g, "ramaiah"],
  [/\bramaih\b/g, "ramaiah"],
  [/\bramaiha\b/g, "ramaiah"],
  [/\bramahaia\b/g, "ramaiah"],
  [/\brammiah\b/g, "ramaiah"],
  [/\bramhai\b/g, "ramaiah"],
  [/\bramhaia\b/g, "ramaiah"],
  [/\bramiaha\b/g, "ramaiah"],
  [/\bramaiaha\b/g, "ramaiah"],
  [/\bmeeknashi\b/g, "meenakshi"],
  [/\bvisvervarayya\b/g, "visvesvaraya"],
  [/\bvisvesvarayya\b/g, "visvesvaraya"],
];

export function normalizeCollege(raw: unknown): string {
  let n = String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\./g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [from, to] of TYPOS) n = n.replace(from, to);
  /* "P E S College" and "R V College" are initials, not three words. */
  n = n.replace(/\bp e s\b/g, "pes").replace(/\br v\b/g, "rv").replace(/\bs j c\b/g, "sjc");
  return n.replace(/\s+/g, " ").trim();
}

const pad = (n: string) => ` ${n} `;
const has = (n: string, phrase: string) => pad(n).includes(` ${phrase} `);
const hasAny = (n: string, phrases: readonly string[]) => phrases.some((p) => has(n, p));

/** Too little to place, or not a college at all. */
const UNUSABLE = new Set(["", "college", "university", "ms r"]);

const OUTSIDE: readonly string[] = [
  "vit ap",
  "mohan babu",
  "srm institute",
  "srm university",
  "srm ktr",
  "srm ramapuram",
  "rajalakshmi",
  "kongu engineering",
  "jeppiaar",
  "perumal manimekalai",
  "perumal manimekai",
  "indra ganesan",
  "indra ganesh",
  "university of hyderabad",
  "nims university",
  "nagaland university",
  "bose university",
  "poornima college",
  "bhopal",
  "lucknow",
  "holy mary",
  "viswa maha vidyalaya",
  "chandrashekarendra",
  "vsb engineering",
  "gorakhpur",
  "buddha institute",
  "aditya college of engineering and technology",
  "sri venkateswara college of engineering",
];

/** Bengaluru institutions whose name does not say the city. */
const BENGALURU: readonly string[] = [
  "ramaiah",
  "ruas",
  "msruas",
  "ms ruas",
  "ruce",
  "sapthagiri",
  "saptagiri",
  "amc engineering",
  "nitte meenakshi",
  "nmit",
  "rv university",
  "rv college",
  "rvce",
  "r v college",
  "rv institute",
  "reva",
  "pes university",
  "pesu",
  "sjb",
  "s j b",
  "dayananda sagar",
  "dayanand sagar",
  "dayanada sagar",
  "dayanadha sagar",
  "dsce",
  "dsatm",
  "acharya",
  "abbs",
  "aacharya",
  "oxford",
  "ambedkar",
  "atria",
  "bmsit",
  "bmsce",
  "bmsca",
  "bms college",
  "bms institute",
  "don bosco",
  "global academy",
  "vemana",
  "venamma",
  "kristu jayanti",
  "bangalore technological",
  "joseph",
  "josephs",
  "new ebenezer",
  "cmrit",
  "cmr institute",
  "cmr university",
  "c m r",
  "jss academy",
  "uvce",
  "visvesvaraya college",
  "jyothy",
  "jyothi institute",
  "brindavan",
  "bnmit",
  "bnm institute",
  "b n m",
  "hkbk",
  "alliance",
  "sea college",
  "sairam",
  "gopalan",
  "vyasa",
  "svyasa",
  "nagarjuna",
  "vivekananda institute",
  "cambridge institute",
  "vijaya vittala",
  "rns institute",
  "rnsit",
  "mvj",
  "visvesvaraya institute",
  "rajarajeshwari",
  "gitam",
  "chanakya",
  "vidyashilp",
  "iisc",
  "seshadripuram",
  "sri venkateshwara",
  "svce bengaluru",
  "acs college",
  "acs collage",
  "presidency",
  "jain university",
  "jain deemed",
  "mount carmel",
  "nandi institution",
  "aditya college of engineering",
  "faculty of dental",
  "bangalore institute",
  "bengaluru institute",
];

/** Karnataka institutions outside Bengaluru, when the town was left off. */
const KARNATAKA: readonly string[] = [
  "mite",
  "mangalore institute",
  "malnad",
  "maland",
  "jawaharlal nehru",
  "jnnce",
  "jnn college",
  "jnn collage",
  "lingaraj",
  "lingara appa",
  "kle technological",
  "ghousia",
  "ghausia",
  "shridevi",
  "sridevi institute",
  "siet",
  "channabasaveshwara",
  "channa basaveshwara",
  "channabasaveswara",
  "cit gubbi",
  "vidyavardhaka",
  "vidya vardhaka",
  "rajeev institute",
  "adichunchanagiri",
  "yenepoya",
  "ballari institute",
  "kishkinda",
  "kishkindha",
  "jain institute of technology",
  "agmrcet",
  "agmr",
  "national institute of engineering",
  "gsss",
  "bvvs",
  "kbn university",
  "thimmaiah",
  "bharatesh",
  "bharstesh",
  "anuvartik",
  "gm university",
  "g m university",
  "sharnbasva",
  "maharaja institute",
  "pesce",
  "jalappa",
  "sjcit",
  "sjc institute",
  "siddhartha",
  "pes college of engineering",
  "pes institute of technology and management",
];

const BENGALURU_PLACES = ["bangalore", "bengaluru", "blr"];
const KARNATAKA_PLACES = [
  "mangalore",
  "moodbidri",
  "moodabidri",
  "moodabidre",
  "badagamijar",
  "mysore",
  "mysuru",
  "mandya",
  "hassan",
  "tumkur",
  "tumkuru",
  "hubli",
  "hubballi",
  "varur",
  "belagavi",
  "belgaum",
  "bagalkot",
  "ballari",
  "bellary",
  "davangere",
  "davanagere",
  "shivamogga",
  "shimoga",
  "shivmogha",
  "kalaburagi",
  "gulbarga",
  "bidar",
  "gokak",
  "ramanagara",
  "ramanagar",
  "gubbi",
  "kolar",
  "kgf",
  "dharwad",
  "chickballapur",
  "chikkaballapur",
  "thandavapura",
];

/**
 * Bucket for one college string. Unknown when the text is blank, junk, or
 * not in the mapping — never a guess at the nearest state.
 */
export function collegeBucket(college: unknown): LocationBucket {
  const n = normalizeCollege(college);
  if (UNUSABLE.has(n) || n.includes("@") || /^[0-9][a-z]{2}[0-9]{2}/.test(n)) return "unknown";
  if (n === "bit") return "bengaluru";
  if (n === "pes" || n === "pesu") return "bengaluru";
  if (n === "vtu" || n === "mit college" || n === "mit collage" || n === "vvit" || n === "university college of science")
    return "unknown";
  if (hasAny(n, OUTSIDE)) return "outside";
  if (has(n, "pes college of engineering") || has(n, "pes institute of technology and management")) return "karnataka";
  if (hasAny(n, BENGALURU_PLACES)) return "bengaluru";
  if (hasAny(n, KARNATAKA_PLACES)) return "karnataka";
  if (hasAny(n, BENGALURU)) return "bengaluru";
  if (hasAny(n, KARNATAKA)) return "karnataka";
  return "unknown";
}

type PlaceRow = {
  college?: string | null;
  fee?: string | null;
  payment?: string | null;
  status?: string | null;
  appliedAt?: string | null;
};

/**
 * One bucket per team. The lead's college decides, because the fee is one
 * payment for the team. When the lead is declined or refunded, a confirmed
 * or in-review teammate's college is used so the team is not dropped.
 */
export function bucketForTeam(members: readonly PlaceRow[]): LocationBucket {
  const held = members.filter(holdsLocationPlace);
  const pool = held.length ? held : members;
  const lead =
    pool.find((m) => m.fee !== COVERED_BY_LEAD && m.payment !== "not_required") ??
    pool.find((m) => m.fee !== COVERED_BY_LEAD) ??
    [...pool].sort((a, b) => String(a.appliedAt ?? "").localeCompare(String(b.appliedAt ?? "")))[0];
  return collegeBucket(lead?.college ?? "");
}
