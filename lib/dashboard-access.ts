import "server-only";

/**
 * Who may open an event's desk.
 *
 * Server-only, and that is the whole point. These addresses used to live on
 * the event objects in lib/pravrutti-data, which every page imports — so all
 * 51 of them were serialised into the public HTML of every event page,
 * scrapeable by anyone who opened view-source. Most are students' own
 * accounts, and two are personal Gmail addresses a coordinator gave us so
 * they could sign in at all.
 *
 * Keyed by slug rather than held on the event so the leak cannot come back:
 * importing this from a client component is a build error, not a silent
 * re-publication. lib/roles.ts is the only thing that needs it, and that
 * runs on the server.
 */
export const DESK_ACCESS: Record<string, string[]> = {
  "robo-race": ["arbharaath@gmail.com", "joshika2505@gmail.com"],
  "line-follower": ["shashankrpatil077@gmail.com", "joshika2505@gmail.com"],
  "kurukshetra-the-robo-war": ["arbharaath@gmail.com", "rathannraj1@gmail.com"],
  "terraform-the-system-awakens": ["sambalagarwal@gmail.com", "radheofficial11@gmail.com"],
  "electroxcape": ["meghahemanna@gmail.com", "sachinmowgli@gmail.com"],
  "discoverize-research-paper-presentation": ["aaliyahaijaz2006@gmail.com", "gnaneshwarign15@gmail.com"],
  "fault-x-load": ["bhauthikfirefly@gmail.com", "vimalkanth411@gmail.com"],
  "campus-innovators-2-0": ["akshayworkofficial01@gmail.com", "nikhita.n0601@gmail.com"],
  "beyond-the-blueprint-2-0": ["akshayworkofficial01@gmail.com", "nikhita.n0601@gmail.com"],
  /* Sooraj Chakravarthy S moved off his college address (25etai@msruas.ac.in),
     given by mistake, on 2 Oct. */
  "respawn": ["jesleneiniya@gmail.com", "soorajchakravarthy3v@gmail.com", "25etmc412021@msruas.ac.in", "24etis411024@msruas.ac.in"],
  "glide-x": ["24etas012008@msruas.ac.in", "24etas012048@msruas.ac.in"],
  "the-logic-circuit": ["25etmc412021@msruas.ac.in", "24etmc412010@msruas.ac.in", "ddhviroja@gmail.com", "rainent27@gmail.com"],
  "rc-x": ["24etas012046@msruas.ac.in", "24etas012033@msruas.ac.in"],
  "leads-innovation-challenge": ["pranavbansal310@gmail.com", "gsiddharth214@gmail.com"],
  "dent-innovate": ["ankush.chadichal@gmail.com", "gowuri.kotabagi@gmail.com"],
  "pitch-at-mach": ["23etas012004@msruas.ac.in", "23etas012002@msruas.ac.in"],
  "bridge-it": ["ramaiahcivilclub@gmail.com", "abhilashnm429@gmail.com"],
  "chaos": ["voxmastery@gmail.com", "shravanth.polisetty@gmail.com"],
  "hacktivate": ["voxmastery@gmail.com", "shravanth.polisetty@gmail.com"],
  "ai-escape-room": ["mynaamadhu30@gmail.com", "anushkanagabhyru05@gmail.com"],
  "bracket-blitz": ["pradeepmadasamy55@gmail.com"],
  "zero-hour": ["sudeepapriyadarshini1826@gmail.com", "tanyashedde@gmail.com"],
  "hammer": ["hrithik18a@gmail.com", "mahadevlakshmanan@gmail.com"],
  "triathlon": ["amantebriwal104@gmail.com", "snehajangid027@gmail.com"],
  "pitch-pulse": ["kirankumar.ee.et@msruas.ac.in", "25etcs002129@msruas.ac.in", "jesleneiniya@gmail.com"],
};

/** Every address that can open some desk, lowercased. */
export function deskEmailsFor(slug: string): string[] {
  return (DESK_ACCESS[slug] ?? []).map((e) => e.trim().toLowerCase());
}
