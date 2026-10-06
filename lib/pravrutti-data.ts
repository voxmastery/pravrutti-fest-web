import { TEST_SITE } from "@/lib/test-site";
import { accommodation } from "@/lib/schedule";

/**
 * A coordinator as the public site knows them: a name, and nothing to dial.
 *
 * Phone numbers deliberately live in lib/coordinator-phones.ts instead. This
 * file is imported by client components for the events array, so anything
 * added here ships to every browser whether or not it is rendered.
 */
export interface Coordinator {
  name: string;
}

export interface Event {
  name: string;
  /** Track. Editorial grouping named by the organisers; see test/event-categories.test.ts. */
  category: "MACHINA" | "TECHNOVERSE" | "CODE & CHAOS" | "INNOVENTURE" | "IDEAFORGE";
  subCategory: string;
  description: string;
  fee: string;
  /** Prize money in rupees, highest first — e.g. [10000, 7000, 5000].
      Per event, straight from the coordinators' sheet. These used to be
      derived from a three-tier system (Visionary/Creator/Explorer), but
      half the events don't fit three tiers, so the real figures live here. */
  prizes: number[];
  /** Min/max team members, and whether one person may enter alone. */
  teamSize: { min: number; max: number; soloAllowed: boolean };
  /** Maximum intake, where the coordinators gave one. Read with capacityUnit —
      most events cap teams, not heads. */
  capacity?: number;
  capacityUnit: "teams" | "participants";
  /** The field size in teams, where the coordinators stated one. Set this when
      it cannot be derived from `capacity`: a head count that is not a whole
      number of max-size teams (TRIATHLON's 210 is 70 threes, not 52.5 fours),
      or an event whose cap was given in people. It wins over the derivation,
      so the page never has to fall back to counting heads. */
  maxTeams?: number;
  /** Taking no new teams. Set by hand when the field is at or over its cap
      and the organisers are deciding who stays. "Full" means no new entry —
      no new team, no new lead or solo registration — and nothing else:
      members can still join a team whose lead is registered, a registered
      lead can still add people, and anyone mid-payment can still finish.
      A switch rather than an automatic cap, so that declining or moving one
      team mid-review does not reopen the place to a stranger. */
  /** Left off the public events list — nobody new goes looking for it —
      while its page still opens, from a ticket or a direct link, for the
      people already registered. Set by hand with `full`, on the organisers'
      call (5 Oct 2026: CHAOS, AI Escape Room, Line Follower). */
  unlisted?: boolean;
  full?: boolean;
  /** ISO instant this event stops taking registrations, when it closes
      earlier than the fest-wide FEST.registrationCloses. Every gate reads it
      through festFor(), so the event page, the forms and the API agree. */
  registrationCloses?: string;
  /** A sponsor's perks for this event's participants, shown under the
      prizes — ElevenLabs on Hacktivate. The logo follows the sponsor's own
      brand guidelines: their white wordmark, on our dark ground. */
  sponsorPerks?: { sponsor: string; logo: string; website: string; perks: string[] };
  /** How long the event runs, e.g. "3 hours", "24 hours". */
  duration?: string;
  /** Entry restriction, where one exists (year, branch, team make-up). */
  eligibility?: string;
  coordinators: {
    faculty: Coordinator[];
    student: Coordinator[];
  };
  /** Rulebook PDF, usually a Google Drive link from the sheet. Empty string
      when there is no participant-facing rulebook yet — every surface hides
      its download button rather than offering a broken one. Never point this
      at an internal document: it is public, and the clubs' proposal forms
      carry personal phone numbers and budgets. */
  brochureUrl: string;
  /** The club running this event, matching a `name` in `clubs` below so its
      tagline can be looked up. Set only where the repo says so outright —
      a description that names its own host, or a club email in
      dashboardEmails. Left unset rather than guessed: the wrong club on a
      public page is worse than no club, and the coordinators stand in as the
      hosts until someone confirms the attribution. */
  club?: string;
  /** Poster artwork (e.g. "/posters/electroxcape.png"). Falls back to a
      generated gradient cover when unset. */
  poster?: string;
  /** Google emails allowed to view this event's dashboard. Lowercase.
      Populated from the collection spreadsheet; empty until it returns. */
  /** Fest day this runs on, 1-3. Enables date grouping once known. */
  day?: 1 | 2 | 3;
  /** Start time, e.g. "10:00 AM". */
  startsAt?: string;
}

/** Indian digit grouping — 4,14,000 rather than 414,000. */
export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** An event's total purse across all its prizes. */
export const prizePool = (e: Event) => e.prizes.reduce((a, b) => a + b, 0);

/**
 * Every prize across every event, added up.
 *
 * Derived rather than written down. The headline previously read
 * "₹8,00,000+" in three places while the coordinators' own figures totalled
 * ₹4,14,000 — an advertised number roughly double what is actually being
 * awarded. Computing it means the claim cannot drift from the prizes again,
 * and it rises on its own as events are added.
 */
export const totalPrizePool = () => events.reduce((sum, e) => sum + prizePool(e), 0);

/**
 * The prize pool as announced by the organising committee, shown on the hero,
 * HUD and About page. It is deliberately NOT the sum of the per-event prizes
 * in the sheet (totalPrizePool, currently lower): the committee's headline
 * figure includes prizes not yet allocated to events. Update this when they
 * revise the announcement; per-event amounts stay the source for event pages.
 */
export const ANNOUNCED_PRIZE_POOL = 600_000;

/** How the team rule reads on screen, e.g. "Teams of 2–4" or "Solo or up to 3". */
/**
 * How many *people* an event can take.
 *
 * `capacity` comes from the sheet's "Max Participants" column, which is
 * already a head count: ROBO RACE reads 80 alongside the note "20 teams × 4",
 * and 20 × 4 is 80. `capacityUnit` records how the coordinators arrived at
 * the figure — it is descriptive, NOT a multiplier.
 *
 * An earlier version multiplied by team size and quadrupled every team-based
 * event, turning a 2,235-place fest into 8,830. Registrations are one record
 * per person, so the raw number already lines up with them.
 *
 * Null when an event gave no cap, so the UI omits the denominator rather than
 * inventing one.
 */
export function capacityInPeople(e: Event): number | null {
  return e.capacity ?? null;
}

/**
 * The capacity as a reader should see it.
 *
 * `capacity` is a head count, but for a team event the coordinators think in
 * teams — Robo War's 64 is "16 teams of 4". Printing the raw number beside the
 * word "teams" therefore claimed 64 teams, four times the real field, so the
 * team count is derived here instead of trusting the unit as a label.
 *
 * Order: an explicit `maxTeams` wins, then the head count divided by the team
 * size when that is whole. Falls back to participants only when teams would be
 * a lie — a cap that is not a whole number of teams (rounding would invent or
 * destroy a place), or a solo event.
 */
export function capacityLabel(e: Event): string | null {
  const teams = maxTeamsFor(e);
  if (teams !== null) return `${teams} ${teams === 1 ? "team" : "teams"}`;
  return e.capacity ? `${e.capacity} participants` : null;
}

/**
 * The field size in teams, or null when the event is not counted that way.
 *
 * The same order capacityLabel uses, exposed so the live seat counter can
 * count teams against it instead of heads. Null means "no honest team figure"
 * — a solo-allowed event whose cap is in people, or a head count that is not a
 * whole number of teams — and callers fall back to counting people.
 */
export function maxTeamsFor(e: Event): number | null {
  if (e.maxTeams && e.maxTeams > 0) return e.maxTeams;
  const cap = e.capacity;
  if (!cap) return null;
  const perTeam = e.teamSize.max;
  if (e.capacityUnit === "teams" && perTeam > 1 && cap % perTeam === 0) return cap / perTeam;
  return null;
}

export function teamLabel(e: Event): string {
  const { min, max, soloAllowed } = e.teamSize;
  if (max === 1) return "Solo only";
  if (soloAllowed) return `Solo or up to ${max}`;
  if (min === max) return `Teams of ${min}`;
  return `Teams of ${min}–${max}`;
}

export interface Sponsor {
  name: string;
  logo: string;
  website: string;
  /** The logo is the sponsor's name set in their own type — a wide wordmark,
      not a square mark. It stands in for the name instead of being squeezed
      into the 48px icon box, where ElevenLabs' 7.7:1 wordmark would be a
      sliver. */
  wordmark?: boolean;
}

export interface Club {
  name: string;
  tagline: string;
}

/**
 * Sponsors, in the order they are shown.
 *
 * `logo` is empty where we have not been sent the mark. Every path in here
 * used to point at a file that was never shipped, so the section quietly drew
 * a category icon for every one and nobody noticed the paths had rotted — a
 * sponsor who sends their logo and does not see it on the page is the kind of
 * thing you hear about afterwards. An empty string says "no mark yet" and the
 * card stands in an icon; a path that is set must resolve, which
 * test/sponsor-logos.test.ts enforces against the filesystem.
 *
 * To add one: drop the file in public/sponsors/ (webp — Hostinger's CDN
 * re-encodes PNG and JPEG into mush) and set the path here.
 */
export const sponsors: Sponsor[] = [
  {
    name: "PCB Cupid",
    logo: "",
    website: "https://pcbcupid.com/"
  },
  {
    name: "IEEE Smart Cities",
    logo: "",
    website: "https://smartcities.ieee.org/"
  },
  {
    /* Hacktivate's partner, 2 Oct 2026. White wordmark from
       elevenlabs.io/brand, written "ElevenLabs" as their guidelines ask. */
    name: "ElevenLabs",
    logo: "/sponsors/elevenlabs.svg",
    website: "https://elevenlabs.io/",
    wordmark: true,
  },
];

export const clubs: Club[] = [
  { name: "AI Club", tagline: "Artificial Intelligence Club" },
  { name: "Cynergy", tagline: "Coding Club" },
  { name: "Robotic Dept.", tagline: "Robotics & Automation" },
  { name: "Math Club", tagline: "Mathematics Club" },
  { name: "ComputeX", tagline: "Computer Science Club" },
  { name: "Aeronyx", tagline: "Aerospace Innovation" },
  { name: "TSS", tagline: "The Startup Society" },
  { name: "LEADS", tagline: "LEADS NextGen Centre" },
  { name: "AeSI", tagline: "Aeronautical Society of India" },
  { name: "ISTE", tagline: "Technical Education Chapter" },
  { name: "IMECHE", tagline: "Institution of Mechanical Engineers" },
  { name: "IEEE", tagline: "IEEE Student Chapter" },
  { name: "Ramaiah Civil Club", tagline: "Civil Engineering Club" },
  { name: "ASME", tagline: "Mechanical Club" },
  { name: "Dental", tagline: "Dental Sciences Club" },
  { name: "IIC", tagline: "Institution Innovation Council — Main Organizer" },
  { name: "Circuitopia", tagline: "Circuit Design Club" },
];

/**
 * The club named on an event, with the tagline from `clubs` attached.
 *
 * Null when the event has no `club` set, which is most of them — see the field
 * comment on Event.club. Callers fall back to listing the coordinators as the
 * hosts, so a missing attribution reads as a complete block rather than a gap.
 */
export function clubFor(e: Event): Club | null {
  if (!e.club) return null;
  return clubs.find((c) => c.name === e.club) ?? { name: e.club, tagline: "Organising club" };
}

export const faqs = [
  {
    question: "Who can participate in PRAVRUTTI?",
    answer: "PRAVRUTTI is open to all university and college students. Some events may have specific prerequisites, so please check the event details page."
  },
  {
    question: "Is there a registration fee?",
    answer: "Yes — ₹200 per team, paid online by the team lead (or by you if you enter solo). Teammates who join with a code do not pay."
  },
  {
    question: "What is the last date for registration?",
    answer: "The last date to register for all events is 9th October 2026, 11:59 PM IST."
  },
  {
    question: "Can I participate in multiple events?",
    answer: "Absolutely! You can participate in as many events as you like, as long as the event timings do not overlap. Please check the schedule carefully."
  },
  {
    question: "Will accommodation be provided for outstation participants?",
    /* Built from the schedule page's figures, so the two cannot disagree
       again — this said "will not be provided" long after beds were
       arranged. */
    answer:
      `Yes — accommodation is available for outstation participants at ` +
      `${accommodation.currency}${accommodation.ratePerHeadPerDay.toLocaleString("en-IN")} per head, per day. To book, call ` +
      accommodation.contacts.map((c) => `${c.name} (${c.phone})`).join(" or ") + "."
  },
  {
    question: "Are there on-the-spot registrations?",
    answer: "No, on-the-spot registrations are not available. We highly recommend registering online in advance to secure your spot."
  },
  {
    question: "What should I bring to the event?",
    answer: "Please bring your college ID card, a government-issued photo ID, and any specific hardware or software required for the events you are participating in."
  },
  {
    question: "What are the prizes for the winners?",
    answer: "Prize money is set per event, not by a shared tier. Open any event to see its exact 1st, 2nd and 3rd place amounts."
  },
  {
    question: "Will participants receive certificates?",
    answer: "Yes, every participant will receive a participation certificate."
  },
  {
    question: "What should I do if I face technical issues during an event?",
    answer: "Don't worry, we'll have student volunteers assigned to each event to help you out with any technical problems."
  },
  {
    question: "How can companies collaborate or sponsor the event?",
    answer: "Companies interested in collaborating or sponsoring should reach out by dropping a mail to the organisers at pravrutti@msruas.ac.in to learn more about the opportunities and partnership packages we offer."
  }
];

export const contacts = {
  email: "pravrutti@msruas.ac.in",
  helpdesk: [
    { name: "Aryan", phone: "+91 8077134700" },
    { name: "Rathan Raj", phone: "+91 6363548034" },
    { name: "Renuka", phone: "+91 8147192405" }
  ],
  location: {
    campus: "Ramaiah Technology Campus",
    address: "470-P, Peenya 4th Phase, Peenya, Bengaluru, Karnataka 560058",
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.2642592717752!2d77.50573037540221!3d13.018836513840283!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae3cfb3dbaee73%3A0xb6777a4ce0b09eb5!2sRamaiah%20University%20Of%20Applied%20Sciences!5e0!3m2!1sen!2sin!4v1756135992146!5m2!1sen!2sin"
  }
};

export const events: Event[] = [
  {
    name: "ROBO RACE",
    category: "MACHINA",
    subCategory: "Precision. Power. Victory.",
    description: "Robo Race is a competitive robotics event that challenges participants to navigate a specially designed obstacle track with their custom-RC bots. The event evaluates speed, precision, control, stability, and obstacle-handling capabilities. Key hints regarding the track will be provided to participants prior to the commencement of the event.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    /* 30 teams (was 20), coordinators' call on 3 Oct; raised to 40 on 4 Oct
       as it neared 30. capacity is the head count at four a team. */
    capacity: 160,
    capacityUnit: "teams",
    maxTeams: 40,
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "A R BHARAATH" }, { name: "JOSHIKA S" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1XFa3H41-N8zeFVjLJ3atgOAIAiE4I9Kh",
  },
  {
    name: "LINE FOLLOWER",
    category: "MACHINA",
    subCategory: "Autonomous Bot Time Trial",
    description: "Line Follower is a robotics competition that challenges participants to design and build an autonomous robot capable of following a predefined track with speed, precision, and accuracy. The robot must navigate turns and track variations while staying on the designated path.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    /* Raised from 24 to 35 teams on 2 Oct, organisers' call: it had closed
       itself at 28 holding places. Raised again to 40 on 4 Oct, when it
       filled all 35. capacity is the head count at the max team size, so
       the desk's meter and the page agree. */
    capacity: 160,
    capacityUnit: "teams",
    /* Closed to new registrations and taken off the list on 5 Oct,
       organisers' call; registered and in-review teams keep their places. */
    full: true,
    unlisted: true,
    maxTeams: 40,
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "SHASHANK" }, { name: "JOSHIKA S" }],
    },
    brochureUrl: "https://drive.google.com/open?id=13buhy5x71UbpF4pzXDKqMsMUFXBDg9VS",
  },
  {
    name: "KURUKSHETRA - THE ROBO WAR",
    category: "MACHINA",
    subCategory: "Engineering Meets Combat",
    description: "Kurushetra - The Robo War brings student-built 8 kg combat robots into the arena for an intense single-elimination showdown. Armed with spinners, flippers, crushers and more, teams battle through three-minute matches where damage, aggression and control decide victory.",
    fee: "Rs. 200/-",
    prizes: [15000, 10000, 7000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 64,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "A R BHARAATH" }, { name: "RATHAN" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1vLwTFYfBYOhMs8thP1fuYEZoph7zpDzK",
  },
  {
    name: "Terraform: The System Awakens",
    category: "CODE & CHAOS",
    subCategory: "Build an AI Survival System",
    description: "You wake up on unknown land with no memory, no knowledge of agriculture, and one tool between you and starvation: TERRAFORM — an interface built to guide you from bare soil to a full harvest. But right now, that System doesn't exist. It's up to you to build it. In this event, teams construct TERRAFORM from scratch across two laptops simultaneously: * One team building the Knowledge Base — deep, structured research that lets an AI genuinely reason about soil, treatment, and crops * The other building the Interface, the face users actually interact with. Both halves must be wired together by the end, forming a System that can walk a user through diagnosing soil, choosing crops, and guiding them all the way to harvest. Each team is assigned one of five distinct land scenarios, and at judging time, they're handed a brand-new, unseen variation of it — a live test of whether their System actually reasons, or just memorized one example. No agricultural background needed. No coding expertise required. Just two laptops, your creativity, and an AI assistant of your choice. The land is waiting. Will your System be ready?",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Sambal Agarwal" }, { name: "Radhe S," }],
    },
    brochureUrl: "https://drive.google.com/open?id=1gsVbyHl7gd1QLAmE2iVsHKvngdUQQZSw",
  },
  {
    name: "ELECTROXCAPE",
    category: "CODE & CHAOS",
    subCategory: "ECE Engineering Challenge",
    description:
      "Teams of four progress through three common engineering missions followed by a semi-final and final. " +
      "\u25cf Round 1 \u2014 a timed system-intelligence challenge involving waveforms, protocols, RTL and circuit evidence. " +
      "\u25cf Round 2.1 \u2014 hands-on fault forensics using deliberately faulty hardware. " +
      "\u25cf Round 2.2 \u2014 implement a constrained system and adapt when a requirement changes. " +
      "\u25cf Semi-final \u2014 the top eight teams face a Blind Handoff, where one pair designs a solution and another implements it using only the provided documentation. " +
      "\u25cf Final \u2014 the top four compete in a final challenge.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 4, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    duration: "3 hours",
    eligibility: "ECE and related engineering students.",
    coordinators: {
      faculty: [],
      student: [{ name: "Sachin R Shenoy" }, { name: "Megha H" }],
    },
    /* Two names, like every other event. The four who used to be listed here
       (K S Aashritha Reddy, Spoorthi K, Sanketh Rao, Prachi Joshi) never came
       through the coordinators' form, so they carried no phone and no call
       button — six names of which four were dead ends for a participant. */
    /* Served from public/ so coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/electroxcape-rules.pdf",
  },
  {
    name: "Discoverize (Research Paper Presentation)",
    category: "INNOVENTURE",
    subCategory: "Research, Present, Inspire & Innovate",
    description:
      "THEME: Transdisciplinary Paradigms for Sustainable Societies \u2014 Science, Technology, and Business Leadership.\n\n" +
      "Showcase your research to a panel of experts! The ISTE Research Paper Presentation is a platform for students and researchers to present original work across disciplines. " +
      "Each participant will submit an abstract and, if shortlisted, present a detailed paper during the fest. Presentations are 7 minutes with a 3-minute Q&A. " +
      "Gain recognition, win cash prizes, and interact with academicians and professionals. Topics include AI/ML, Robotics, Energy, IoT, Biomedical Engineering, and more. " +
      "Step up, share your findings, and make an impact. " +
      "\u25cf Stage 1 (Abstract Submission) \u2014 participants submit an abstract of at most 300 words, which MUST include Title, Objective, Methodology, Key Findings and Conclusion. Teams have a few days to submit it through the Google Form provided. " +
      "\u25cf Stage 2 (Presentation Round) \u2014 selected participants present their paper live: 7 minutes for the presentation (PPT, 10 slides recommended) and 3 minutes for Q&A. Shortlisted teams present on 14 October, 2:00 PM to 5:00 PM, in front of the judges. " +
      "\u25cf NOTE \u2014 only shortlisted teams pay Rs. 200/- through the website. Every team should NOT pay to take part. Only a team that has passed the screening round (Round 1) is asked for the Rs. 200/-, to present in front of the judges in the final round. " +
      "\u25cf Presentation day \u2014 teams wait for their turn in the waiting room and are called to present in an isolated room when it is their turn.",
    /* Free at every stage, shortlisted or not. Starting with "Free" is also
       what makes the register route treat it as a free event (see
       lib/discoverize.ts for the whole flow). */
    fee: "Free",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 1, max: 4, soloAllowed: true },
    /* No cap, organisers' call 2 Oct: it had closed itself at 60 people with
       61 holding places. Entry is only the abstract round — the judges'
       shortlist decides who presents — so the field need not be limited. */
    capacityUnit: "participants",
    /* Registrations closed on 6 Oct, organisers' call: no new entries. Teams
       already in keep their places, and screening and the shortlist carry on
       at /dashboard/discoverize. */
    full: true,
    duration: "3 hours",
    eligibility: "Diploma, UG, PG and Ph.D. students",
    coordinators: {
      faculty: [],
      student: [{ name: "Aaliyah Aijaz Ali Khan" }, { name: "Gnaneshwari N" }],
    },
    /* Served from public/ so the coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/discoverize-rulebook.pdf",
  },
  {
    name: "FAULT x LOAD",
    category: "MACHINA",
    subCategory: "Engineering Escape Challenge",
    description: "Step into a factory where everything has gone wrong. Teams must build, measure, troubleshoot and solve a series of hands-on engineering challenges before time runs out. From constructing a load-bearing spaghetti bridge to diagnosing machine failures and restarting the final system, participants will test their creativity, teamwork and problem-solving skills in an immersive engineering experience.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 60,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Bhauthik V" }, { name: "Vimal Kanth" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1Nww0T18stoR2-cxuD5qIa2sd1S38WcBo",
  },
  {
    name: "Campus Innovators 2.0",
    category: "IDEAFORGE",
    subCategory: "SDG Pitching Challenge",
    description: "● Round 1 [SDG Problem Scouting & Solution Blueprint (Online)]: Teams draw an SDG track at random (e.g., Affordable Clean Energy, Sustainable Cities, Industry & Innovation, Responsible Consumption, Good Health). Teams conduct rapid campus / regional field exploration, define a specific operational bottleneck, propose a feasible technological or business solution, and submit a structured 2-page executive summary by the deadline ● Round 2 (Live Venture Pitch): Top 10 shortlisted teams deliver a live investor-style pitch before an esteemed industry and academic jury. Each team gets 5 minutes for presentation (max 7 slides) followed by 3 minutes of rigorous Q&A with the jury",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 240,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Akshay" }, { name: "Nikhita" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1nn121x9xhfh1-sBKjEvltB1T4UdWJQIi",
  },
  {
    name: "Beyond the Blueprint 2.0",
    category: "IDEAFORGE",
    subCategory: "Case Study",
    description: "● Round 1 (Case Study Analysis & Strategic Deck Submission): Registered teams receive a comprehensive case dossier on a contemporary tech venture navigating growth stagnation, product-market pivot, or ethical AI governance. Teams analyze quantitative/qualitative data and submit a structured 5-page case abstract covering root cause diagnosis, strategic options, feasibility, and 3-year financial impact ● Round 2 (Grand Boardroom Pitch): Top 10 qualifying teams present their strategic blueprint live in a boardroom simulation format. Each team receives 5 minutes of presentation time (maximum 7 slides) and faces 3 minutes of rigorous stress-testing questions from executive judges",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 160,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Akshy P M" }, { name: "Nikhita" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1nn121x9xhfh1-sBKjEvltB1T4UdWJQIi",
  },
  {
    name: "Respawn",
    category: "CODE & CHAOS",
    subCategory: "Game Building Challenge",
    description:
      "Beginner or an expert? Love games? Then RESPAWN – The 2D Game Jam is your chance to build it, play it and bring it to life!\n\nParticipants will be added to an official WhatsApp group after registration and the general theme will be revealed at 9AM on October 13, marking the start of the 12-Hour Online Building Round from 9:00 AM to 9:00 PM. Teams of 3–4 members can bring their ideas to life by building their own 2D game based on the given theme in any genre, using any game engine or framework of their choice. The Google Drive link for submitting their 3 screen-recorded progress videos at 4-hour intervals will be shared in the group along with further instructions. Simple creative elements such as patterns, symmetry or other mathematical touches can also be incorporated for additional points.\n\nAfter the 12-hour building round, teams will get 2 days (October 14 and 15) to polish their games, fix bugs, improve gameplay and get their final builds ready. The offline round will be on October 16 with a Live Pitching & Showcase, where teams will showcase their final playable games on campus before the judges, where each team will have 5 minutes to present their game, followed by 3 minutes for Q&A about their game and its technical implementation. Teams will be evaluated based on the submitted videos, documentation, creativity, technical execution, gameplay, and presentation, with the best teams competing to claim the title of RESPAWN Champion!",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 160,
    capacityUnit: "teams",
    duration: "12+3 hours",
    coordinators: {
      faculty: [],
      student: [
        { name: "Jeslene Iniya D" },
        { name: "Sooraj Chakravarthy S" },
      ],
    },
    /* Served from public/ so coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/respawn-rules.pdf",
  },
  {
    name: "Glide-X",
    category: "MACHINA",
    subCategory: "Non-Technical Event",
    description: "Glide-X is an aerodynamics-focused glider competition where participants design and build a non-RC, passively stable glider to compete under standardized launch conditions. The event challenges teams to apply aerodynamics, flight mechanics, and aircraft stability principles to optimize their designs for maximum flight time and distance while maintaining a straight and stable flight path. With an optional common mechanical launcher ensuring to help with launches, the competition places emphasis on design efficiency, aerodynamic performance, stability, and innovation.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 2, max: 2, soloAllowed: false },
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "B S Mokshada" }, { name: "Siddharth P" }],
    },
    brochureUrl: "/glide-x-rules.pdf",
  },
  {
    name: "The Logic Circuit",
    category: "CODE & CHAOS",
    subCategory: "Mathematical logic driven digital competition",
    description: "Experience THE LOGIC CIRCUIT, Techfest’s high-stakes digital puzzle race. Teams of up to three share one laptop to crack logic problems and puzzles, and unlock progression keys on a competitive local network. Facing off against all teams simultaneously, only the sharpest problem-solvers will survive each round. The first three teams to complete the final challenge in the correct sequence claim victory. Do you want to explore and experience the hidden world of problem solving? Fasten your focus—it’s time to outsmart the circuit.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 1, max: 3, soloAllowed: true },
    capacity: 120,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Spandana J S" }, { name: "Dhvani Viroja" }],
    },
    brochureUrl: "https://drive.google.com/open?id=12PxcuNAKMp-XQCC1ACFht2C6jXHV0Z4o",
  },
  {
    name: "RC-X",
    category: "MACHINA",
    subCategory: "Technical Event",
    description: "RC–X puts your aircraft design, building and piloting skills to the test. Form a team of 3–4, build your aircraft, take to the skies and prove that you can stay in control when precision matters most. Before the challenge begins, every aircraft must clear a mandatory technical inspection to ensure it meets the event’s technical and safety requirements. Teams that pass move on to the qualification round where they must demonstrate stable flight, maneuverability and control over their plane by demonstrating a safe landing. The real challenge begins in the final round. Teams must complete two full loops around the designated field, navigate two obstacles, and accurately drop a 20 g payload into the target zone. ● Build constraints worth knowing before you start: electric propulsion only, no more than two motors, and no VTOL — IC engines and gearboxes are out, and an aircraft that breaks any of these does not clear inspection. The rulebook has the full set, including the 650 mm wingspan, the 1:1 thrust-to-weight limit and the battery caps. So test your build, sharpen your flying and take on the course.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Shravya T" }, { name: "Pranav P J" }],
    },
    /* Served from public/ so coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/rc-x-rules.pdf",
  },
  {
    name: "LEADS Innovation Challenge",
    category: "IDEAFORGE",
    subCategory: "Startup Simulation",
    description: "LEADS Innovation Challenge is a non-technical entrepreneurship and leadership simulation run over two connected rounds and 100 marks. In Round 1 teams get a startup problem statement and have 50 minutes to build the venture around it — name, concept, logo, brand identity, positioning and target audience, all created during the event. Judges shortlist from there, and Round 2 hands each surviving team a crisis tied to its own startup: adapt the strategy, then pitch the whole journey to an investor-style panel for 8 minutes with 2 minutes of questions on feasibility, scalability, financial sustainability and how the crisis was handled. The startup you create in the first hour is the one you defend to the end. No prior startup experience is needed, nothing may be prepared in advance, and cross-disciplinary teams are encouraged.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    /* Rulebook: "Minimum Team Size: 2 Members". The sheet said 1 with solo
       allowed, which had the site offering an entry the rulebook forbids. */
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    /* 135 minutes end to end in the rulebook's timeline, briefing and prize
       distribution included. */
    duration: "2h 15m",
    eligibility: "UG and PG students, all departments and years",
    /* Two names, like every other event. Dr. Pallabi Mund (faculty) used to be
       listed alongside these two, making three; no other event lists a faculty
       coordinator publicly, so the students are the two kept here. */
    coordinators: {
      faculty: [],
      student: [{ name: "Pranav Bansal" }, { name: "Siddharth Gupta" }],
    },
    club: "LEADS",
    /* Served from the site rather than Drive: the Drive copy is the older
       rulebook, and a link students cannot open on a locked-down phone is a
       rulebook they do not read. */
    brochureUrl: "/leads-innovation-challenge-rules.pdf",
  },
  {
    name: "DENT - INNOVATE",
    category: "INNOVENTURE",
    subCategory: "Technical",
    description: "DENT-INNOVATE 2026 is an exciting postgraduate e-poster competition showcasing innovative ideas that enhance patient care through the integration of technology, clinical expertise, and improved outcomes. Participants will present creative concepts, research innovations, and technology-driven solutions addressing contemporary challenges in dentistry. \u25cf Entry is by abstract: send a 250-word unstructured abstract to fdsruasresearch@gmail.com. Accepted entries then receive the presentation template, the guidelines and their time slot. \u25cf One slide only, on the template provided \u2014 title in Calibri 32, body in Calibri 24\u201328, headings in bold. Leave your name, department, institution and logo off it. \u25cf Presentations begin at 2:30 pm on 15 October. Bring the deck on a pendrive and upload it by 2:00 pm, and be seated in the hall fifteen minutes before the start. \u25cf Five minutes to present and two for questions, strictly kept. The jury's decision is final. Join this platform to share ideas, inspire collaboration, demonstrate innovation, and contribute towards shaping the future of patient-centred dental care.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 1, max: 2, soloAllowed: true },
    capacity: 50,
    capacityUnit: "participants",
    /* Paused on 5 Oct, reopened on 6 Oct with its move to 15 Oct, 2:30 PM —
       organisers' call. */
    duration: "3 hours",
    /* 15 Oct, 2:30 PM — moved from 14 Oct, 2:00 PM on 6 Oct, organisers' call. */
    day: 2,
    startsAt: "2:30 PM",
    eligibility: "Open to postgraduate students.",
    coordinators: {
      faculty: [],
      student: [{ name: "Ankush Chadichal" }, { name: "Abhilashree B Hosmani" }],
    },
    /* The Drive file that used to sit here was the club's internal "Event
       Proposal, Requirement Form & Guidelines" — three personal mobile
       numbers, four personal email addresses and the event budget, served
       publicly from the rulebook button — so it was pulled. This replaces it:
       the participant-facing rules the coordinators sent, and nothing else. */
    brochureUrl: "/dent-innovate-rules.pdf",
  },
  {
    name: "PITCH AT MACH",
    category: "INNOVENTURE",
    subCategory: "Think. Design. Defend.",
    description:
      "PITCH AT MACH is an aerospace pitch competition in which teams are provided with problem statements spanning Aeronautics, Astronautics, and UAVs a week before the event. " +
      "Each team can pick a problem of their choice, understand the problem, come up with a feasible and innovative solution, and pitch it in front of a jury on the day of the event. " +
      "The team should also defend their solution against a set of rigorous Q&A, in which the jury will assess the team's technical understanding of both the given problem statement and their proposed solution.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Ankith A Joshi" }, { name: "Afifa Fatima Karigar" }],
    },
    brochureUrl: "https://drive.google.com/open?id=1_-znmVyUw5XJYEnpXfQ0SzuQXG0_Lq68",
  },
  {
    name: "BRIDGE IT",
    category: "MACHINA",
    subCategory: "Bridging Knowledge, Innovation & Real-World Civil Engineering",
    description: "BRIDGE IT is a hands-on structural engineering challenge where participants design and construct a model bridge using limited materials. Teams must apply basic structural engineering concepts while focusing on load-carrying capacity, innovation, efficient material utilization, and technical presentation. The completed bridge will be tested under load to determine its structural performance.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    /* A duo event: exactly two, not a range. teamLabel renders this as
       "Teams of 2", and the register dialog + API refuse a third. */
    teamSize: { min: 2, max: 2, soloAllowed: false },
    capacity: 80,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Abhilash N M" }, { name: "Rajeshwari" }],
    },
    club: "Ramaiah Civil Club",
    brochureUrl: "https://drive.google.com/open?id=154puKWw4eax-7EaWMGhwhuRj1yztw_N_",
  },
  {
    name: "CHAOS",
    category: "TECHNOVERSE",
    subCategory: "8-Hour Software Hackathon",
    description: "CHAOS is an 8-hour on-site hackathon hosted by the IEEE Student Branch. Teams of 2 to 4 students build a working software solution from scratch against a real-world problem, judged live at the end of the day — no recorded demos, no slide-only submissions. Problem statements are revealed only on the day itself, so no team walks in pre-prepared. Every team starts from zero and builds the entire product within the same eight hours. What sets CHAOS apart is its Buffs & Debuffs wheel. Four times throughout the day, a spin on the main screen hands the entire hall either a helpful perk or a fun, bothersome restriction (voice-only coding, no Enter key, whisper-mode communication) for the next thirty minutes. Every team faces the same twist at the same time, keeping the day unpredictable without affecting anyone's score. CHAOS gives students a full problem-to-demo cycle in a single day, under the same pressure and unpredictability.",
    fee: "Rs. 200/-",
    prizes: [15000, 10000, 7000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacityUnit: "teams",
    unlisted: true,
    /* Registrations full, organisers' call, 2 Oct. Switched to full by hand —
       CHAOS has no stated cap — so it stays shut until this is removed. */
    full: true,
    duration: "8 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Ganesh" }, { name: "Shravanth" }],
    },
    club: "IEEE",
    brochureUrl: "https://drive.google.com/open?id=1OMN_3v5Wxu6UhkZXUKWaAXtyNw6aROmo",
  },
  {
    name: "Hacktivate",
    category: "TECHNOVERSE",
    subCategory: "24-Hour Predictive Systems Hackathon",
    description: "Hacktivate is a 24-hour overnight hackathon on the theme of Predictive Systems, hosted by the IEEE Student Branch. Teams of 2 to 4 design and build a working hardware and software system that senses real-world data and predicts an outcome — machine failure, demand shifts, anomalies, or early warnings. Teams move through the full development cycle: ideation, circuit and system design with simulation, component procurement from an on-site stall, hardware assembly and sensor integration, and finally layering in the predictive logic. Mentors are available throughout, including overnight. The event closes with a live demonstration — every system must power on and perform in front of the judges. Components are sourced on-site through PCB Cupid, the component partner. Meals, overnight refreshments, and a supervised rest area are provided. It is a full product build compressed into a single night, and the kind of end-to-end experience few students get before industry.",
    fee: "Rs. 200/-",
    prizes: [20000, 15000, 10000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacityUnit: "teams",
    /* Closes early: 11:59 PM IST on 1 October, organisers' call. */
    registrationCloses: "2026-10-01T18:29:59.000Z",
    sponsorPerks: {
      sponsor: "ElevenLabs",
      logo: "/sponsors/elevenlabs.svg",
      website: "https://elevenlabs.io/",
      perks: [
        "Every participant: 1 month of ElevenLabs Creator, free",
        "Overall winning team: 3 months of ElevenLabs Pro for each member",
        "Best project built with ElevenLabs: 3 months of ElevenLabs Scale for each member",
      ],
    },
    duration: "24 hours",
    coordinators: {
      faculty: [],
      /* Shravanth alone since 2 Oct — Ganesh asked to come off Hacktivate.
         He stays on CHAOS. */
      student: [{ name: "Shravanth" }],
    },
    club: "IEEE",
    brochureUrl: "https://drive.google.com/open?id=1agRe2bIb_QXyatw1OcwjvKi0EtU5W0VL",
  },
  {
    name: "AI ESCAPE ROOM",
    category: "CODE & CHAOS",
    subCategory: "Prompt Engineering Challenge",
    description: "Our event is an immersive, team-based escape room experience designed to challenge participants through a series of mysterious rooms filled with hidden clues, puzzles, and unexpected challenges. Each room presents a different type of problem that requires observation, logical thinking, creativity, teamwork, and careful attention to detail. Participants must work together, communicate effectively, and think beyond the obvious to uncover the path forward. The puzzles are designed to be challenging and deceptive, encouraging teams to question what they see and discover connections between seemingly unrelated elements. As teams progress through the rooms, the difficulty and mystery build, creating an exciting and competitive atmosphere. The event is not just about solving puzzles—it is about strategy, collaboration, time management, and thinking differently under pressure. Every team must rely on its collective skills and instincts to navigate the experience and ultimately complete the escape room challenge within the given time.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 100,
    capacityUnit: "teams",
    unlisted: true,
    /* 29 teams were holding places against the 25 when this went on, 2 Oct.
       Switched to full by the organisers; remove it to reopen. */
    full: true,
    duration: "1h 30m",
    coordinators: {
      faculty: [],
      student: [{ name: "Madhumitha A" }, { name: "N Anushka" }],
    },
    /* Served from public/ rather than Drive: a Drive link shows a
       "request access" wall to anyone outside the owner's account. */
    brochureUrl: "/escape-room-rules.pdf",
  },
  {
    name: "Bracket blitz",
    category: "MACHINA",
    subCategory: "Design",
    description: "Bracket Blitz is an exciting team-based technical event where team of 3 to 4 members design, test, and 3D print their models. Participating teams will be provided with design requirements, loading conditions, dimensional constraints, and material specifications. Based on the given specifications and constraints, teams should come up with their own alternative designs to withstand the given load. Teams will then use engineering calculations and FEA to validate their models to check for stress concentration and possible failures in their design to optimize it for better strength with minimal material usage.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 60,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Pradeep Raj M" }, { name: "Suman A" }],
    },
    /* Served from public/ so coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/bracket-blitz-rules.pdf",
  },
  {
    name: "ZERO HOUR",
    category: "CODE & CHAOS",
    subCategory: "Code. Survive. Conquer.",
    description: "ZERO HOUR Think a hackathon is just pick a problem, open your laptop, and start coding? Think again. 3 hours. 4 people. 3 Gauntlets. 1 final goal. Welcome to Zero Hour — a hackathon where coding is only part of the game. At kickoff, the clock starts and so does the uncertainty. Your team will choose a mystery theme and race to build a working technical solution before time runs out. But just when you think you have found your rhythm, the Gauntlets begin. Three surprise challenges. Three different team members. Three chances to change your score. Every Gauntlet is timed, every point matters, and your team’s final score depends on how well each member performs when it is their turn. There is no hiding behind the strongest coder. No endless time to rethink. No guarantee that your perfect plan will survive the next challenge. You will have to code, adapt, communicate, make quick decisions, and keep your team moving when things stop going according to plan. Then comes the final push: submit your solution, face the judges, and defend what you built. The question is simple: When the clock hits zero, will your team have what it takes to survive Zero Hour?",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 4, max: 4, soloAllowed: false },
    capacity: 200,
    capacityUnit: "teams",
    duration: "3 hours",
    coordinators: {
      faculty: [],
      student: [{ name: "Sudeepa Priyadarshini" }, { name: "Tanya Shedde" }],
    },
    /* Served from public/ so coordinators can hand over a replacement
       without anyone needing Drive permissions. */
    brochureUrl: "/zero-hour-rules.pdf",
  },
  {
    name: "HAMMER",
    category: "TECHNOVERSE",
    subCategory: "Hack Analyze Master Market Execute Rule",
    description: "*The Cyber-Escape & Live IPL Auction Arena* We bring a unique two-stage competitive arena fusing high-pressure web debugging with the adrenaline of a live IPL Mega Auction. *The Battle Breakdown* * ROUND 1: IPL Technical Escape Room Teams enter a multi-stage cyber-investigation platform where they must inspect, analyse, and decode web components (HTML, CSS, JavaScript) to crack ciphers, analyze cricket datasets, and unlock master qualification keys. * ROUND 2: Live IPL Mega Auction The top 8 qualifying teams from round 1 step into the live auction war room. Armed with a virtual purse of 80 Crores and real-time digital bidding terminals, franchises will battle across marquee and accelerated sets to construct the ultimate championship roster under strict squad constraints.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 160,
    capacityUnit: "teams",
    duration: "6 hours",
    eligibility: "Teams must consist of 3 to 4 members.",
    coordinators: {
      faculty: [],
      student: [{ name: "Hrithik A" }, { name: "L Mahadeva Balan" }],
    },
    brochureUrl: "https://drive.google.com/file/d/1ReNsPaD1nCLpK5bnTO9dHwFjVXEH-_tt/view?usp=drive_open",
  },
  {
    name: "TRIATHLON",
    category: "CODE & CHAOS",
    subCategory: "Code. Crack. Conquer.",
    description: "Three rounds. One connected technical challenge. Every round shapes the next, with scores turning into hints and discoveries giving you an advantage as you progress. There are no eliminations — all three rounds count, and every point, hint and discovery can change the outcome. ● Round 1 – ByteLock (Coding & CS Quiz): test your programming, logic and computer-science skills in a fast-paced quiz designed to challenge how quickly you can think and spot what others miss. Your Round 1 score earns Hint Tokens for Round 2. ● Round 2 – Debug Mode (Application Bug Hunt): step into a deliberately broken application and uncover what lies beneath. Find hidden bugs, identify unexpected behaviour and earn points for every valid discovery, with bonus points for finding something beyond the expected. Your Round 2 performance earns Hint Points for Round 3. ● Round 3 – Root Access (CTF Puzzle Hunt): put everything to the test in the final hunt. Solve technical puzzles, uncover hidden clues, chase flags and spend your Hint Points strategically as you race against the clock.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 210,
    capacityUnit: "teams",
    /* 210 is 70 teams of three, the only whole reading — dividing by the max of
       four gives 52.5, which is why this used to fall back to counting heads. */
    maxTeams: 70,
    duration: "3 hours",
    eligibility: "Teams must have 2–4 members. All members must be present for the full event. Team members cannot be changed once the event begins.",
    coordinators: {
      faculty: [],
      student: [{ name: "Aman Tebriwal" }, { name: "Sneha" }],
    },
    brochureUrl: "/triathlon-rules.pdf",
  },
  {
    name: "Pitch Pulse",
    category: "IDEAFORGE",
    subCategory: "Startup & Project Pitching Challenge",
    description:
      "Got an idea that could solve a real-world problem? Pitch Pulse is the stage for it. Choose a problem that interests you, work up a solution, and bring it to life in a 7+3 pitch \u2014 seven minutes to present, then three minutes of questions from an expert jury. \u25cf Open innovation: teams pick their own problem statement. There is no shortlisting or elimination round beforehand \u2014 every approved team pitches on the day. \u25cf Official template: the presentation template reaches every registered team a week before the event. Use it without altering its core structure, and bring your deck on a USB flash drive or pendrive. \u25cf Judged holistically by an expert jury on overall pitch performance, innovation, and the potential of the project. The jury's decision is final and binding. \u25cf Bring your own laptop, charger and extension cord. \u25cf Plagiarism, misrepresentation or misconduct means immediate disqualification. Whether you are a builder, an entrepreneur, a creative thinker, or a fresher with nothing but an idea, this is somewhere to be heard.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 1, max: 4, soloAllowed: true },
    capacity: 280,
    capacityUnit: "teams",
    duration: "3 hours",
    eligibility: "Open to all UG and PG students. Cross-department and cross-year teams are welcome. Working professionals may not enter.",
    coordinators: {
      faculty: [{ name: "Kiran Kumar BM" }],
      student: [{ name: "Jeslene Iniya D" }],
    },
    brochureUrl: "/pitch-pulse-rules.pdf",
    club: "IIC",
  },
];

/** The events the public list shows: everything not marked unlisted. Pages,
    tickets and the desk still use `events`, which has every event. */
export const listedEvents = events.filter((e) => !e.unlisted);

// ── Registration system ──────────────────────────────────────
export const eventId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const DEFAULT_CAPACITY = 100;
export const EVENT_CAPACITY: Record<string, number> = {
  // override per-event: "electroxcape": 60,
};

/**
 * Seat cap for the registration meter. Sourced from the event's own
 * `capacity` (the coordinators' head count) so the meter and the event
 * panel always quote the same number — a blanket default here once had
 * ROBO RACE showing "Capacity 80" beside "0 of 100 seats".
 */
const CAPACITY_BY_ID: Record<string, number> = Object.fromEntries(
  events
    .filter((e) => e.capacity != null)
    .map((e) => [eventId(e.name), e.capacity as number])
);
/** The capacity to quote to an applicant, or null when the event has no
    stated cap. capacityFor falls back to a placeholder 100, which told
    somebody registering for CHAOS they were "#300 of 100". */
export const statedCapacity = (id: string): number | null => {
  const e = events.find((x) => eventId(x.name) === id);
  return e ? capacityInPeople(e) : null;
};

export const capacityFor = (id: string) =>
  EVENT_CAPACITY[id] ?? CAPACITY_BY_ID[id] ?? DEFAULT_CAPACITY;

export const FEST = {
  name: "Pravrutti 2026",
  venue: "Ramaiah Technology Campus, Bengaluru",
  dates: "14\u201316 October 2026",
  // IST (UTC+5:30) converted to UTC for calendar invites
  startUtc: "20261014T033000Z", // 09:00 IST, 14 Oct
  endUtc: "20261016T123000Z",   // 18:00 IST, 16 Oct
  /** ISO instant registration closes, or null for no announced deadline.
      9 October 2026, 11:59:59 PM IST (extended from 5 October on 5 Oct,
      organisers' call). After it the site stops taking applications on its
      own; nothing else needs changing. */
  registrationCloses: "2026-10-09T18:29:59.000Z" as string | null,
  /** ISO instant registration opens. null until the committee announces it,
      which the site renders as "Opening soon" and refuses applications. */
  registrationOpens: "2026-09-16T00:00:00.000Z" as string | null,
};

export type RegistrationState = "upcoming" | "open" | "closed";

/**
 * Where registration is in its lifecycle. Three states, not a boolean: before
 * the announced opening (or while none is announced) the site must say
 * "opening soon", never "closed", and it must not accept applications either.
 * `now` and `fest` are parameters so the boundaries are testable.
 */
export const registrationState = (
  now: number = Date.now(),
  fest: { registrationCloses: string | null; registrationOpens: string | null } = FEST
): RegistrationState => {
  // No announced deadline means registration does not close on its own.
  if (fest.registrationCloses && now >= Date.parse(fest.registrationCloses)) return "closed";
  if (!fest.registrationOpens || now < Date.parse(fest.registrationOpens)) return "upcoming";
  return "open";
};

export const registrationOpen = (
  now: number = Date.now(),
  fest: { registrationCloses: string | null; registrationOpens: string | null } = FEST
) => registrationState(now, fest) === "open";

/**
 * The registration state the app should actually gate on.
 *
 * Identical to registrationState() everywhere real — but in the registration-open override
 * (Vercel only, see lib/test-site.ts) it reports "open" so the real dialog
 * can be walked there. registrationState() itself stays pure and unchanged so
 * its boundary tests keep testing the real rule; only the runtime gates use
 * these. pravrutti.tech never sets the flag, so it is unaffected.
 */
export const effectiveRegistrationState = (
  now?: number,
  fest?: { registrationCloses: string | null; registrationOpens: string | null }
): RegistrationState => (TEST_SITE ? "open" : registrationState(now, fest));

export const effectiveRegistrationOpen = (
  now?: number,
  fest?: { registrationCloses: string | null; registrationOpens: string | null }
) => (TEST_SITE ? true : registrationOpen(now, fest));

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** IST is UTC+5:30; the fest's own timestamps are stored as UTC instants. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Day one, for the calendar-tile badges. Read off startUtc rather than typed
 * again by hand, because a badge that disagrees with FEST.dates sends someone
 * to campus on the wrong morning.
 */
export const FEST_START = (() => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(FEST.startUtc);
  if (!m) return { day: "", month: "" };
  return { day: String(Number(m[3])), month: MONTHS_SHORT[Number(m[2]) - 1] ?? "" };
})();

/**
 * The closing deadline as participants read it: an IST calendar date.
 *
 * Shifted into IST before the parts are read, because the stored instant is
 * 18:29:59Z — a bare toLocaleDateString() renders 04 October in India and
 * 04 or 05 depending on the runtime elsewhere, and Vercel builds in UTC.
 */
export const REGISTRATION_CLOSES_DISPLAY = (() => {
  if (!FEST.registrationCloses) return "";
  const ist = new Date(Date.parse(FEST.registrationCloses) + IST_OFFSET_MS);
  if (Number.isNaN(ist.getTime())) return "";
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS_SHORT[ist.getUTCMonth()] ?? ""} ${ist.getUTCFullYear()}`;
})();

/** FEST with this event's own closing time, where it has one. Pass the result
    to the registration-state helpers so one event can close early. */
export const festFor = (e?: { registrationCloses?: string } | null) =>
  e?.registrationCloses ? { ...FEST, registrationCloses: e.registrationCloses } : FEST;

/** An event's own closing time as participants read it, in IST:
    "11:59 PM, 01 OCT 2026". Empty when it follows the fest-wide date. */
export const eventClosesDisplay = (e?: { registrationCloses?: string } | null) => {
  if (!e?.registrationCloses) return "";
  const ist = new Date(Date.parse(e.registrationCloses) + IST_OFFSET_MS);
  if (Number.isNaN(ist.getTime())) return "";
  const h = ist.getUTCHours(), m = String(ist.getUTCMinutes()).padStart(2, "0");
  const time = `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "AM" : "PM"}`;
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${time}, ${day} ${MONTHS_SHORT[ist.getUTCMonth()] ?? ""} ${ist.getUTCFullYear()}`;
};

/** The fest-wide deadline as a headline: "5th October". IST, like the rest. */
/** An instant as an IST date in words: "9th October". Empty if unreadable. */
export function longIstDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const ist = new Date(Date.parse(iso) + IST_OFFSET_MS);
  if (Number.isNaN(ist.getTime())) return "";
  const d = ist.getUTCDate();
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  const month = ist.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `${d}${suffix} ${month}`;
}

export const REGISTRATION_CLOSES_LONG = longIstDate(FEST.registrationCloses);

/** Refusal text for an event that closed early on its own date. */
export const eventClosedMessage = (e: { name: string; registrationCloses?: string }) =>
  `Registration for ${e.name} closed at ${eventClosesDisplay(e)} IST.`;

/** Refusal text for an event switched to full — see Event.full. */
export const eventFullMessage = (name: string) =>
  `${name} is full and isn’t taking new teams. Teams already registered are unaffected — if you’re on one, join it with its team code.`;

/** API refusal text, so every route says the same thing for the same reason. */
export const registrationUnavailableMessage = (state: RegistrationState = registrationState()) =>
  state === "upcoming"
    ? "Registration hasn\u2019t opened yet \u2014 check back soon."
    : REGISTRATION_CLOSES_DISPLAY
    ? `Applications closed on ${REGISTRATION_CLOSES_DISPLAY}.`
    : "Applications are closed.";


/**
 * Campus coordinates, read off the map embed that already points at the venue.
 * The hero HUD used to carry hand-typed coordinates ~5km from campus; the embed
 * URL is the one place in this repo where the real position is already correct,
 * so it is the source. Null if the URL shape ever changes — callers drop the
 * line rather than print a guess.
 */
export const CAMPUS_COORDS = (() => {
  const url = contacts.location.embedUrl;
  const lat = Number(/!3d(-?\d+(?:\.\d+)?)/.exec(url)?.[1]);
  const lng = Number(/!2d(-?\d+(?:\.\d+)?)/.exec(url)?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label =
    `${Math.abs(lat).toFixed(4)}\u00B0 ${lat >= 0 ? "N" : "S"}, ` +
    `${Math.abs(lng).toFixed(4)}\u00B0 ${lng >= 0 ? "E" : "W"}`;
  return { lat, lng, label };
})();

/**
 * The organisation behind every event, for the "Presented by" block.
 *
 * The same for every event, unlike Event.club: IIC is recorded as the fest's
 * main organiser in the `clubs` list above, and the university hosts it.
 */
export const PRESENTER = {
  name: FEST.name,
  org: "Institution Innovation Council · Ramaiah University of Applied Sciences",
  blurb:
    "The annual inter-college technical fest of Ramaiah University of Applied Sciences \u2014 25 events across engineering, research, code and enterprise, run by 16 student clubs.",
  email: contacts.email,
};

/**
 * The one-line "when" for an event, Luma's compact date row.
 *
 * Uses the event's own day and start time once the coordinators supply them,
 * and otherwise states the fest range rather than inventing a slot — an event
 * page that guesses a time sends someone to campus on the wrong morning.
 */
export function eventWhen(e: Event): { line: string; exact: boolean } {
  if (!e.day) return { line: FEST.dates, exact: false };

  const start = new Date(Date.UTC(2026, 9, 13 + e.day, 3, 30));
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(start);

  return e.startsAt
    ? { line: `${date}, ${e.startsAt}`, exact: true }
    : { line: date, exact: false };
}
