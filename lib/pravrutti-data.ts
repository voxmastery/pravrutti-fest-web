export interface Coordinator {
  name: string;
  phone: string;
}

export interface Event {
  name: string;
  category: "Engineering and Design" | "Research and Presentation" | "Code and Compute" | "Enterprise and Expression";
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
  /** Maximum participants, where the coordinators gave one. */
  capacity?: number;
  coordinators: {
    faculty: Coordinator[];
    student: Coordinator[];
  };
  /** Rulebook PDF, usually a Google Drive link from the sheet. */
  brochureUrl: string;
  /** Hall / lab inside the campus. Falls back to FEST.venue when unset. */
  venue?: string;
  /** Poster artwork (e.g. "/posters/electroxcape.png"). Falls back to a
      generated gradient cover when unset. */
  poster?: string;
  /** Google emails allowed to view this event's dashboard. Lowercase.
      Populated from the collection spreadsheet; empty until it returns. */
  dashboardEmails?: string[];
  /** Fest day this runs on, 1-3. Enables date grouping once known. */
  day?: 1 | 2 | 3;
  /** Start time, e.g. "10:00 AM". */
  startsAt?: string;
}

/** Indian digit grouping — 4,14,000 rather than 414,000. */
export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** An event's total purse across all its prizes. */
export const prizePool = (e: Event) => e.prizes.reduce((a, b) => a + b, 0);

/** How the team rule reads on screen, e.g. "Teams of 2–4" or "Solo or up to 3". */
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
}

export interface Club {
  name: string;
  tagline: string;
}

export const sponsors: Sponsor[] = [
  {
    name: "RUAS Incubator (RTBI)",
    logo: "/RTBI.png",
    website: "https://ruas-incubator.com/"
  },
  {
    name: "KASSIA",
    logo: "/KASSIA_Logo-removebg-preview.png",
    website: "https://kassia.org.in/"
  },
  {
    name: "Jamboree",
    logo: "/Logo - 9458x2128 .png",
    website: "https://www.jamboreeindia.com"
  },
  {
    name: "GeeksforGeeks",
    logo: "/gfglogo-removebg-preview copy.jpeg",
    website: "https://www.geeksforgeeks.org/"
  },
  {
    name: "Unstop",
    logo: "/unnamed-2.jpg",
    website: "https://unstop.com/"
  }
];

export const clubs: Club[] = [
  { name: "AI Club", tagline: "Artificial Intelligence Club" },
  { name: "Cynergy", tagline: "Coding Club" },
  { name: "Robotic Dept.", tagline: "Robotics & Automation" },
  { name: "Math Club", tagline: "Mathematics Club" },
  { name: "ComputeX", tagline: "Computer Science Club" },
  { name: "Aeronyx", tagline: "Aerospace Innovation" },
  { name: "TSS", tagline: "Technical Student Society" },
  { name: "LEADS", tagline: "Leadership Club" },
  { name: "AeSI", tagline: "Aeronautical Society of India" },
  { name: "ISTE", tagline: "Technical Education Chapter" },
  { name: "IMECHE", tagline: "Institution of Mechanical Engineers" },
  { name: "IEEE", tagline: "IEEE Student Chapter" },
  { name: "Civil Club", tagline: "Civil Engineering Club" },
  { name: "ASME", tagline: "Mechanical Club" },
  { name: "Dental", tagline: "Dental Sciences Club" },
  { name: "IIC", tagline: "Institution Innovation Council — Main Organizer" },
  { name: "Circuitopia", tagline: "Circuit Design Club" },
];

export const faqs = [
  {
    question: "Who can participate in PRAVRUTTI?",
    answer: "PRAVRUTTI is open to all university and college students. Some events may have specific prerequisites, so please check the event details page."
  },
  {
    question: "Is there a registration fee?",
    answer: "Yes — ₹200 per head. Solo entries pay ₹200; teams pay ₹200 times the number of participants (up to 4 including the lead). Payment is collected online."
  },
  {
    question: "What is the last date for registration?",
    answer: "The deadline for registrations for all the events would be 04th of October 2026 , 11:59 PM IST."
  },
  {
    question: "Can I participate in multiple events?",
    answer: "Absolutely! You can participate in as many events as you like, as long as the event timings do not overlap. Please check the schedule carefully."
  },
  {
    question: "Will accommodation be provided for outstation participants?",
    answer: "Accommodation will not be provided , however we will be suggesting the accommodations near to the venue."
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
    { name: "Renuka", phone: "+91 8147192405" },
    { name: "Aryan", phone: "+91 8077134700" },
    { name: "Rathan Raj", phone: "+91 6363548034" }
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
    category: "Engineering and Design",
    subCategory: "Precision. Power. Victory.",
    description: "Robo Race is a competitive robotics event that challenges participants to navigate a specially designed obstacle track with their custom-RC bots. The event evaluates speed, precision, control, stability, and obstacle-handling capabilities. Key hints regarding the track will be provided to participants prior to the commencement of the event.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 80,
    venue: "GROUND",
    coordinators: {
      faculty: [],
      student: [{ name: "A R BHARAATH", phone: "7259513381" }, { name: "JOSHIKA S", phone: "9611367397" }],
    },
    dashboardEmails: ["arbharaath@gmail.com", "joshika2505@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1XFa3H41-N8zeFVjLJ3atgOAIAiE4I9Kh",
  },
  {
    name: "LINE FOLLOWER",
    category: "Engineering and Design",
    subCategory: "Autonomous Bot Time Trial",
    description: "Line Follower is a robotics competition that challenges participants to design and build an autonomous robot capable of following a predefined track with speed, precision, and accuracy. The robot must navigate turns and track variations while staying on the designated path.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 96,
    venue: "C BLOCK",
    coordinators: {
      faculty: [],
      student: [{ name: "SHASHANK", phone: "9449913019" }, { name: "JOSHIKA S", phone: "9611367397" }],
    },
    dashboardEmails: ["shashankrpatil077@gmail.com", "joshika2505@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=13buhy5x71UbpF4pzXDKqMsMUFXBDg9VS",
  },
  {
    name: "KURUKSHETRA - THE ROBO WAR",
    category: "Engineering and Design",
    subCategory: "Engineering Meets Combat",
    description: "Kurushetra - The Robo War brings student-built 8 kg combat robots into the arena for an intense single-elimination showdown. Armed with spinners, flippers, crushers and more, teams battle through three-minute matches where damage, aggression and control decide victory.",
    fee: "Rs. 200/-",
    prizes: [15000, 10000, 7000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 64,
    venue: "Quadrangle",
    coordinators: {
      faculty: [],
      student: [{ name: "A R BHARAATH", phone: "7259513381" }, { name: "RATHAN", phone: "6363548034" }],
    },
    dashboardEmails: ["arbharaath@gmail.com", "rathannraj1@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1vLwTFYfBYOhMs8thP1fuYEZoph7zpDzK",
  },
  {
    name: "Terraform: The System Awakens",
    category: "Code and Compute",
    subCategory: "Build an AI Survival System",
    description: "You wake up on unknown land with no memory, no knowledge of agriculture, and one tool between you and starvation: TERRAFORM — an interface built to guide you from bare soil to a full harvest. But right now, that System doesn't exist. It's up to you to build it. In this event, teams construct TERRAFORM from scratch across two laptops simultaneously: * One team building the Knowledge Base — deep, structured research that lets an AI genuinely reason about soil, treatment, and crops * The other building the Interface, the face users actually interact with. Both halves must be wired together by the end, forming a System that can walk a user through diagnosing soil, choosing crops, and guiding them all the way to harvest. Each team is assigned one of five distinct land scenarios, and at judging time, they're handed a brand-new, unseen variation of it — a live test of whether their System actually reasons, or just memorized one example. No agricultural background needed. No coding expertise required. Just two laptops, your creativity, and an AI assistant of your choice. The land is waiting. Will your System be ready?",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 60,
    venue: "Classroom",
    coordinators: {
      faculty: [],
      student: [{ name: "Sambal Agarwal", phone: "7307430193" }, { name: "Radhe S,", phone: "9686138774" }],
    },
    dashboardEmails: ["sambalagarwal@gmail.com", "radheofficial11@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1gsVbyHl7gd1QLAmE2iVsHKvngdUQQZSw",
  },
  {
    name: "ELECTROXCAPE",
    category: "Engineering and Design",
    subCategory: "ECE Engineering Challenge",
    description: "Teams of four progress through three common engineering missions followed by a semi-final and final. Round 1 is a timed system-intelligence challenge involving waveforms, protocols, RTL and circuit evidence. Round 2.1 is hands-on fault forensics using deliberately faulty hardware. Round 2.2 requires teams to implement a constrained system and adapt when a requirement changes. The top eight teams advance to a semi-final Blind Handoff, where one pair designs a solution and another implements it using only the provided documentation. The top four then compete in a final challenge.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 4, max: 4, soloAllowed: false },
    capacity: 100,
    venue: "Labs",
    coordinators: {
      faculty: [],
      student: [{ name: "SACHIN R SHENOY", phone: "9353539822" }, { name: "Megha H", phone: "8867365326" }],
    },
    dashboardEmails: ["23etec004041@msruas.ac.in", "23etec004029@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=18KxuqhLxOT4JSr8f3mEzE5Kcxtv3AFvN",
  },
  {
    name: "Discoverize (Research Paper Presentation)",
    category: "Research and Presentation",
    subCategory: "Research, Present, Inspire & Innovate",
    description: "Present your original research work and innovative ideas before a panel of experts and a larger audience! The event encourages academic excellence, knowledge sharing, and critical discussion on cutting-edge technologies and interdisciplinary innovations. Participants will undergo an abstract submission process, followed by live paper presentations during the Tech Fest. Students, professionals and researchers are welcome!",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 1, max: 4, soloAllowed: true },
    capacity: 60,
    venue: "Seminar Hall ( A-206)",
    coordinators: {
      faculty: [],
      student: [{ name: "Aaliyah Aijaz Ali Khan", phone: "8197092607" }, { name: "Gnaneshwari N", phone: "7829004057" }],
    },
    dashboardEmails: ["24etis411003@msruas.ac.in", "24etis411024@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=18erNy24IizpT-tTM8fRlfAfMVoNut9M_",
  },
  {
    name: "FAULT x LOAD",
    category: "Engineering and Design",
    subCategory: "Engineering Escape Challenge",
    description: "Step into a factory where everything has gone wrong. Teams must build, measure, troubleshoot and solve a series of hands-on engineering challenges before time runs out. From constructing a load-bearing spaghetti bridge to diagnosing machine failures and restarting the final system, participants will test their creativity, teamwork and problem-solving skills in an immersive engineering experience.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 60,
    venue: "Basketball Court",
    coordinators: {
      faculty: [],
      student: [{ name: "Bhauthik V", phone: "9742385315" }, { name: "Vimal Kanth", phone: "6361245327" }],
    },
    dashboardEmails: ["bhauthikfirefly@gmail.com", "vimalkanth411@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1Nww0T18stoR2-cxuD5qIa2sd1S38WcBo",
  },
  {
    name: "Campus Innovators 2.0",
    category: "Enterprise and Expression",
    subCategory: "SDG Pitching Challenge",
    description: "● Round 1 [SDG Problem Scouting & Solution Blueprint (Online)]: Teams draw an SDG track at random (e.g., Affordable Clean Energy, Sustainable Cities, Industry & Innovation, Responsible Consumption, Good Health). Teams conduct rapid campus / regional field exploration, define a specific operational bottleneck, propose a feasible technological or business solution, and submit a structured 2-page executive summary by the deadline ● Round 2 (Live Venture Pitch): Top 10 shortlisted teams deliver a live investor-style pitch before an esteemed industry and academic jury. Each team gets 5 minutes for presentation (max 7 slides) followed by 3 minutes of rigorous Q&A with the jury",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 240,
    venue: "Seminar Hall (capacity of about 70-90 students)",
    coordinators: {
      faculty: [],
      student: [{ name: "Akshay", phone: "9686226622" }, { name: "Nikhita", phone: "9380268311" }],
    },
    dashboardEmails: ["akshayworkofficial01@gmail.com", "nikhita.n0601@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1nn121x9xhfh1-sBKjEvltB1T4UdWJQIi",
  },
  {
    name: "Beyond the Blueprint 2.0",
    category: "Enterprise and Expression",
    subCategory: "Case Study",
    description: "● Round 1 (Case Study Analysis & Strategic Deck Submission): Registered teams receive a comprehensive case dossier on a contemporary tech venture navigating growth stagnation, product-market pivot, or ethical AI governance. Teams analyze quantitative/qualitative data and submit a structured 5-page case abstract covering root cause diagnosis, strategic options, feasibility, and 3-year financial impact ● Round 2 (Grand Boardroom Pitch): Top 10 qualifying teams present their strategic blueprint live in a boardroom simulation format. Each team receives 5 minutes of presentation time (maximum 7 slides) and faces 3 minutes of rigorous stress-testing questions from executive judges",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 160,
    venue: "Executive Seminar Hall (capacity of about 70-90 students)",
    coordinators: {
      faculty: [],
      student: [{ name: "Akshy P M", phone: "9686226622" }, { name: "Nikhita", phone: "9380268311" }],
    },
    dashboardEmails: ["akshayworkofficial01@gmail.com", "nikhita.n0601@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1nn121x9xhfh1-sBKjEvltB1T4UdWJQIi",
  },
  {
    name: "Respawn",
    category: "Code and Compute",
    subCategory: "Game Building Challenge",
    description: "Respawn is a 2D Gameathon, Teams of 3 to 4 participants can participate in the event. The theme will be announced after registrations close in the official whatsApp group or discord group. Just a day before the event we willl provide a 12 hour time frame within which they have to develop the game based on the announced theme. They are free to use free AI tools and other permitted resources during the development process. Teams must submit three progress videos, one for every four hours of the 12 hour time frame, along with the date and time clearly visible in each video. These videos along with the final code must be submitted through the official google drive link which will be provided. If in case the registrations are high, shortlisted teams will be presenting their work during the finale.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 160,
    venue: "Classrooms",
    coordinators: {
      faculty: [],
      student: [{ name: "Jeslene Iniya D", phone: "8148817683" }, { name: "Sooraj Chackravarthy", phone: "63602 69253" }],
    },
    dashboardEmails: ["jesleneiniya@gmail.com", "25etai@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=1ElTKXfek8BiWYo1kUeftetELkYiwshJU",
  },
  {
    name: "Glide-X",
    category: "Engineering and Design",
    subCategory: "Non-Technical Event",
    description: "Glide-X is an aerodynamics-focused glider competition where participants design and build a non-RC, passively stable glider to compete under standardized launch conditions. The event challenges teams to apply aerodynamics, flight mechanics, and aircraft stability principles to optimize their designs for maximum flight time and distance while maintaining a straight and stable flight path. With an optional common mechanical launcher ensuring to help with launches, the competition places emphasis on design efficiency, aerodynamic performance, stability, and innovation.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 2, max: 2, soloAllowed: false },
    coordinators: {
      faculty: [],
      student: [{ name: "B S Mokshada", phone: "93538 24957" }, { name: "Siddharth P", phone: "70223 95629" }],
    },
    dashboardEmails: ["24etas012008@msruas.ac.in", "24etas012048@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=1HHwcSPITqCzUs5vOgqvZsIOUVqQQe-Ij",
  },
  {
    name: "The Logic Circuit",
    category: "Code and Compute",
    subCategory: "Mathematical logic driven digital competition",
    description: "Experience THE LOGIC CIRCUIT, Techfest’s high-stakes digital puzzle race. Teams of up to three share one laptop to crack logic problems and puzzles, and unlock progression keys on a competitive local network. Facing off against all teams simultaneously, only the sharpest problem-solvers will survive each round. The first three teams to complete the final challenge in the correct sequence claim victory. Do you want to explore and experience the hidden world of problem solving? Fasten your focus—it’s time to outsmart the circuit.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 1, max: 3, soloAllowed: true },
    capacity: 120,
    coordinators: {
      faculty: [],
      student: [{ name: "Spandana J S", phone: "6364220817" }, { name: "Dhvani Viroja", phone: "8460357383" }],
    },
    dashboardEmails: ["25etmc412021@msruas.ac.in,", "24etmc412010@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=12PxcuNAKMp-XQCC1ACFht2C6jXHV0Z4o",
  },
  {
    name: "RC-X",
    category: "Engineering and Design",
    subCategory: "Technical Event",
    description: "RC–X puts your aircraft design, building and piloting skills to the test. Form a team of 3–4, build your aircraft, take to the skies and prove that you can stay in control when precision matters most. Before the challenge begins, every aircraft must clear a mandatory technical inspection to ensure it meets the event’s technical and safety requirements. Teams that pass move on to the qualification round where they must demonstrate stable flight, maneuverability and control over their plane by demonstrating a safe landing. The real challenge begins in the final round. Teams must complete two full loops around the designated field, navigate two obstacles, and accurately drop a 20 g payload into the target zone. So test your build, sharpen your flying and take on the course.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 100,
    coordinators: {
      faculty: [],
      student: [{ name: "Shravya T", phone: "99948 35916" }, { name: "Pranav P J", phone: "95677 34887" }],
    },
    dashboardEmails: ["24etas012046@msruas.ac.in", "24etas012033@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=1YqfGErhuVVse0_nbROkZ3KTdZugd3pcz",
  },
  {
    name: "LEADS Innovation Challenge",
    category: "Enterprise and Expression",
    subCategory: "Startup Simulation",
    description: "LEADS Innovation Challenge is a 2-hour startup leadership simulation where teams build a venture from a problem card, defend it through a live mid-event crisis twist, and pitch the complete journey to an investor-style panel testing innovation, adaptability, branding instinct, and leadership, all under real time pressure.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 1, max: 4, soloAllowed: true },
    capacity: 100,
    coordinators: {
      faculty: [],
      student: [{ name: "Nuthan.H", phone: "9019133340" }, { name: "Kunal Bhadauria", phone: "9019857885" }],
    },
    dashboardEmails: ["nuthann268@gmail.com", "kunalbhadauria232005@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1u5DF4HDP9whgfiCe5OwqOgzV-CXd3IPd",
  },
  {
    name: "DENT - INNOVATE",
    category: "Research and Presentation",
    subCategory: "Technical",
    description: "DENT-INNOVATE 2026 is an exciting postgraduate e-poster competition showcasing innovative ideas that enhance patient care through the integration of technology, clinical expertise, and improved outcomes. Participants will present creative concepts, research innovations, and technology-driven solutions addressing contemporary challenges in dentistry. Join this platform to share ideas, inspire collaboration, demonstrate innovation, and contribute towards shaping the future of patient-centred dental care.",
    fee: "Rs. 200/-",
    prizes: [10000, 7000, 5000],
    teamSize: { min: 1, max: 2, soloAllowed: true },
    capacity: 50,
    coordinators: {
      faculty: [],
      student: [{ name: "Ankush Chadichal", phone: "8073411261" }, { name: "Abhilashree B Hosmani", phone: "7975965514" }],
    },
    dashboardEmails: ["ankush.chadichal@gmail.com", "gowuri.kotabagi@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1CEDr_uGifU8BXsAPK3ZwU968vxwZtHA-",
  },
  {
    name: "PITCH AT MACH",
    category: "Enterprise and Expression",
    subCategory: "Think. Design. Defend.",
    description: "PITCH AT MACH is an aerospace pitch competition, in which the teams are provided with a problem statement a week before the event. Each team will understand the problem, and come up with a feasible and innovative solution and pitch it infront of a jury on the day of the event. The team should also defend their solution against a set of rigorous Q&A, in which the jury will assess the team's technical understanding of both the given problem statement and their proposed solutions.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 100,
    coordinators: {
      faculty: [],
      student: [{ name: "Ankith A Joshi", phone: "8217684051" }, { name: "Afifa Fatima Karigar", phone: "9741698766" }],
    },
    dashboardEmails: ["23etas012004@msruas.ac.in", "23etas012002@msruas.ac.in"],
    brochureUrl: "https://drive.google.com/open?id=1_-znmVyUw5XJYEnpXfQ0SzuQXG0_Lq68",
  },
  {
    name: "BRIDGE IT",
    category: "Engineering and Design",
    subCategory: "Bridging Knowledge, Innovation & Real-World Civil Engineering",
    description: "BRIDGE IT is a hands-on structural engineering challenge where participants design and construct a model bridge using limited materials. Teams must apply basic structural engineering concepts while focusing on load-carrying capacity, innovation, efficient material utilization, and technical presentation. The completed bridge will be tested under load to determine its structural performance.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 80,
    venue: "Normal Class room",
    coordinators: {
      faculty: [],
      student: [{ name: "Abhilash N M", phone: "8618488065" }, { name: "Rajeshwari", phone: "9019328888" }],
    },
    dashboardEmails: ["ramaiahcivilclub@gmail.com", "kadaganchirajeshwaariv@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=154puKWw4eax-7EaWMGhwhuRj1yztw_N_",
  },
  {
    name: "CHAOS",
    category: "Code and Compute",
    subCategory: "8-Hour Software Hackathon",
    description: "CHAOS is an 8-hour on-site hackathon hosted by the IEEE Student Branch. Teams of 2 to 4 students build a working software solution from scratch against a real-world problem, judged live at the end of the day — no recorded demos, no slide-only submissions. Problem statements are revealed only on the day itself, so no team walks in pre-prepared. Every team starts from zero and builds the entire product within the same eight hours. What sets CHAOS apart is its Buffs & Debuffs wheel. Four times throughout the day, a spin on the main screen hands the entire hall either a helpful perk or a fun, bothersome restriction (voice-only coding, no Enter key, whisper-mode communication) for the next thirty minutes. Every team faces the same twist at the same time, keeping the day unpredictable without affecting anyone's score. Backed by industry sponsors including Cursor, CHAOS gives students a full problem-to-demo cycle in a single day, under the same pressure and unpredictability.",
    fee: "Rs. 200/-",
    prizes: [15000, 10000, 7000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    venue: "Seminar Hall or Lab",
    coordinators: {
      faculty: [],
      student: [{ name: "Ganesh", phone: "7975324769" }, { name: "Shravanth", phone: "6363860239" }],
    },
    dashboardEmails: ["voxmastery@gmail.com", "shravanth.polisetty@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1OMN_3v5Wxu6UhkZXUKWaAXtyNw6aROmo",
  },
  {
    name: "Hacktivate",
    category: "Code and Compute",
    subCategory: "24-Hour Predictive Systems Hackathon",
    description: "Hacktivate is a 24-hour overnight hackathon on the theme of Predictive Systems, hosted by the IEEE Student Branch. Teams of 2 to 4 design and build a working hardware and software system that senses real-world data and predicts an outcome — machine failure, demand shifts, anomalies, or early warnings. Teams move through the full development cycle: ideation, circuit and system design with simulation, component procurement from an on-site stall, hardware assembly and sensor integration, and finally layering in the predictive logic. Mentors are available throughout, including overnight. The event closes with a live demonstration — every system must power on and perform in front of the judges. Components are sourced on-site through PCB Cupid, the component partner. Meals, overnight refreshments, and a supervised rest area are provided. It is a full product build compressed into a single night, and the kind of end-to-end experience few students get before industry.",
    fee: "Rs. 200/-",
    prizes: [20000, 15000, 10000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    venue: "Lab or Workshop",
    coordinators: {
      faculty: [],
      student: [{ name: "Ganesh", phone: "7975324769" }, { name: "Shravanth", phone: "6363860239" }],
    },
    dashboardEmails: ["voxmastery@gmail.com", "shravanth.polisetty@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1agRe2bIb_QXyatw1OcwjvKi0EtU5W0VL",
  },
  {
    name: "AI ESCAPE ROOM",
    category: "Code and Compute",
    subCategory: "Prompt Engineering Challenge",
    description: "Our event is an immersive, team-based escape room experience designed to challenge participants through a series of mysterious rooms filled with hidden clues, puzzles, and unexpected challenges. Each room presents a different type of problem that requires observation, logical thinking, creativity, teamwork, and careful attention to detail. Participants must work together, communicate effectively, and think beyond the obvious to uncover the path forward. The puzzles are designed to be challenging and deceptive, encouraging teams to question what they see and discover connections between seemingly unrelated elements. As teams progress through the rooms, the difficulty and mystery build, creating an exciting and competitive atmosphere. The event is not just about solving puzzles—it is about strategy, collaboration, time management, and thinking differently under pressure. Every team must rely on its collective skills and instincts to navigate the experience and ultimately complete the escape room challenge within the given time.",
    fee: "Rs. 200/-",
    prizes: [5000, 3000, 2000],
    teamSize: { min: 2, max: 4, soloAllowed: false },
    capacity: 60,
    venue: "A BLOCK CLASSROOM",
    coordinators: {
      faculty: [],
      student: [{ name: "Madhumitha A", phone: "9025678951" }, { name: "N Anushka", phone: "9606853110" }],
    },
    dashboardEmails: ["mynaamadhu30@gmail.com", "anushkanagabhyru05@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1o8gS1yTY5fSg8XD3qbfgg-rGfo07WueJ",
  },
  {
    name: "Bracket blitz",
    category: "Engineering and Design",
    subCategory: "Design",
    description: "Bracket Blitz is an exciting team-based technical event where team of 3 to 4 members design, test, and 3D print their models. Participating teams will be provided with design requirements, loading conditions, dimensional constraints, and material specifications. Based on the given specifications and constraints, teams should come up with their own alternative designs to withstand the given load. Teams will then use engineering calculations and FEA to validate their models to check for stress concentration and possible failures in their design to optimize it for better strength with minimal material usage.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 60,
    venue: "cad lab - 3d printing",
    coordinators: {
      faculty: [],
      student: [{ name: "Pradeep Raj M", phone: "9025329551" }, { name: "Suman A", phone: "6364519267" }],
    },
    dashboardEmails: ["pradeepmadasamy55@gmail.com"],
    brochureUrl: "https://drive.google.com/file/d/1gXYhjUKu1XHG3I-icVGC9wN_kt0yI8AZ/view",
  },
  {
    name: "ZERO HOUR",
    category: "Code and Compute",
    subCategory: "Code. Survive. Conquer.",
    description: "ZERO HOUR Think a hackathon is just pick a problem, open your laptop, and start coding? Think again. 3 hours. 4 people. 3 Gauntlets. 1 final goal. Welcome to Zero Hour — a hackathon where coding is only part of the game. At kickoff, the clock starts and so does the uncertainty. Your team will choose a mystery theme and race to build a working technical solution before time runs out. But just when you think you have found your rhythm, the Gauntlets begin. Three surprise challenges. Three different team members. Three chances to change your score. Every Gauntlet is timed, every point matters, and your team’s final score depends on how well each member performs when it is their turn. There is no hiding behind the strongest coder. No endless time to rethink. No guarantee that your perfect plan will survive the next challenge. You will have to code, adapt, communicate, make quick decisions, and keep your team moving when things stop going according to plan. Then comes the final push: submit your solution, face the judges, and defend what you built. The question is simple: When the clock hits zero, will your team have what it takes to survive Zero Hour?",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 4, max: 4, soloAllowed: false },
    capacity: 200,
    venue: "A BLOCK 5 classrooms",
    coordinators: {
      faculty: [],
      student: [{ name: "Sudeepa Priyadarshini", phone: "9900964418" }, { name: "Tanya Shedde", phone: "7483573793" }],
    },
    dashboardEmails: ["sudeepapriyadarshini1826@gmail.com", "tanyashedde@gmail.com"],
    brochureUrl: "https://drive.google.com/file/d/1oh_df3Ze1iqCe1sLigOMs1Ywi63ysGNS/view",
  },
  {
    name: "HAMMER",
    category: "Code and Compute",
    subCategory: "Hack Analyze Master Market Execute Rule",
    description: "*The Cyber-Escape & Live IPL Auction Arena* We bring a unique two-stage competitive arena fusing high-pressure web debugging with the adrenaline of a live IPL Mega Auction. *The Battle Breakdown* * ROUND 1: IPL Technical Escape Room Teams enter a multi-stage cyber-investigation platform where they must inspect, analyse, and decode web components (HTML, CSS, JavaScript) to crack ciphers, analyze cricket datasets, and unlock master qualification keys. * ROUND 2: Live IPL Mega Auction The top 8 qualifying teams from round 1 step into the live auction war room. Armed with a virtual purse of 80 Crores and real-time digital bidding terminals, franchises will battle across marquee and accelerated sets to construct the ultimate championship roster under strict squad constraints.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 160,
    coordinators: {
      faculty: [],
      student: [{ name: "Hrithik A", phone: "9686505558" }, { name: "L Mahadeva Balan", phone: "8147197853" }],
    },
    dashboardEmails: ["hrithik18a@gmail.com |", "mahadevlakshmanan@gmail.com"],
    brochureUrl: "https://drive.google.com/file/d/1ReNsPaD1nCLpK5bnTO9dHwFjVXEH-_tt/view?usp=drive_open",
  },
  {
    name: "TRIATHLON",
    category: "Code and Compute",
    subCategory: "Quiz. Build. Breach.",
    description: "Triathlon is a three-round technical event run as one connected game. Teams of 2–3 compete across a coding and computer-science quiz, a PC-building challenge, and a capture-the-flag puzzle hunt. Unlike a normal multi-round event, the rounds are linked: what a team earns in one round becomes a resource it spends in the next, so consistency across all three rounds decides the winner. There is no elimination — every team plays all three rounds and the scores are added up. The three rounds are: ● Round 1 – Coding & CS Quiz (25 min): a timed quiz on programming and computer-science fundamentals, including 'predict the output' and 'find the bug' questions and one question where AI-written code has a hidden mistake. The top 4 teams then play a live buzzer round. The Round 1 score sets each team's budget for Round 2. ● Round 2 – PC Build Fix & Adapt (60 min): teams are given a faulty PC parts list on PCPartPicker and must find and fix the mistakes. Midway through, the requirements change (budget or use-case) and teams must rework the build, then briefly justify their choices. The Round 2 score converts into hint points for Round 3. ● Round 3 – CTF Puzzle Hunt (50 min): a jeopardy-style set of cybersecurity puzzles — hidden messages, simple ciphers, web and forensics challenges, and one clue hidden on a poster in the CSE block. Each team gets team-specific flags so answers cannot be shared, a live scoreboard is projected, and teams can spend the hint points earned in Round 2. The team with the highest combined score across all three rounds wins. The tie-breaker is the time taken in Round 3.",
    fee: "Rs. 200/-",
    prizes: [7000, 5000, 3000],
    teamSize: { min: 3, max: 4, soloAllowed: false },
    capacity: 210,
    venue: "Seminar Hall / Classroom (Round 1) and Computer Lab (Rounds 2 and 3)",
    coordinators: {
      faculty: [],
      student: [{ name: "Aman Tebriwal", phone: "62046 75554" }, { name: "Sneha", phone: "73558 82325" }],
    },
    dashboardEmails: ["amantebriwal104@gmail.com", "snehajangid027@gmail.com"],
    brochureUrl: "https://drive.google.com/open?id=1sSsvN1DOCowLaWqpeNWncriNXRJkmS8O",
  },
];

export interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

/**
 * Photos from the previous edition (Pravrutti, 15–17 October 2025).
 *
 * TO ADD PHOTOS: drop the files into `public/gallery/` and append an entry here.
 * The About-page gallery renders exactly what this list contains and hides itself
 * entirely when the list is empty, so it can never ship as a broken/empty grid.
 */
export const previousEditionGallery: GalleryImage[] = [
  {
    src: "/about.jpeg",
    alt: "Pravrutti 2025 campaign poster — 15 to 17 October 2025, 10 lakh prize pool",
    caption: "Pravrutti 2025 — the edition that set the bar",
  },
];

// ── Registration system ──────────────────────────────────────
export const eventId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const DEFAULT_CAPACITY = 100;
export const EVENT_CAPACITY: Record<string, number> = {
  // override per-event: "electroxcape": 60,
};
export const capacityFor = (id: string) => EVENT_CAPACITY[id] ?? DEFAULT_CAPACITY;

export const FEST = {
  name: "Pravrutti 2026",
  venue: "Ramaiah Technology Campus, Bengaluru",
  dates: "14\u201316 October 2026",
  // IST (UTC+5:30) converted to UTC for calendar invites
  startUtc: "20261014T033000Z", // 09:00 IST, 14 Oct
  endUtc: "20261016T123000Z",   // 18:00 IST, 16 Oct
  registrationCloses: "2026-10-04T18:29:59.000Z" // 04 Oct 2026, 11:59 PM IST
};

export const registrationOpen = () => Date.now() < Date.parse(FEST.registrationCloses);
