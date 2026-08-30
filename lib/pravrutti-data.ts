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
  type: "Visionary" | "Creator" | "Explorer";
  coordinators: {
    faculty: Coordinator[];
    student: Coordinator[];
  };
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
    answer: "Prizes vary depending on the event category—Visionary, Creator, or Explorer. Check out the 'Prizes' section on the main page for more information."
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
  // --- Engineering and Design ---
  {
    name: "ElectroXcape",
    category: "Engineering and Design",
    subCategory: "escape room electronics",
    description: "ElectroXcape is a dynamic and immersive electronics competition designed to bridge logic, hardware, and innovation. This event tests participants’ understanding of core electronics concepts, logical reasoning, and circuit design through hands-on challenges in Arduino programming, sensor interfacing, and PCB layout development.",
    fee: "Rs. 200/-",
    type: "Visionary",
    coordinators: {
      faculty: [{ name: "Mr. Divya Kiran", phone: "8971638139" }],
      student: [
        { name: "Kushal M K", phone: "8618844218" },
        { name: "Akash Arumugam", phone: "9606694466" }
      ]
    },
    brochureUrl: "/Electroxcape.pdf"
  },
  {
    name: "SkyCraft",
    category: "Engineering and Design",
    subCategory: "glider aircraft",
    description: "Take flight with SkyCraft, a celebration of aviation’s past, present, and future. This event challenges students to blend creativity with engineering by building physical models of legendary aircraft, futuristic concepts, or original designs. From historic icons to visionary prototypes, SkyCraft is where imagination meets aerospace innovation.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. M. Sivapragasam", phone: "8049065555" }],
      student: [
        { name: "Ankith A Josh", phone: "8217684051" },
        { name: "Debopriya Dutta", phone: "8972871552" }
      ]
    },
    brochureUrl: "/SkyCraft.pdf"
  },
  {
    name: "Robo Climb",
    category: "Engineering and Design",
    subCategory: "climbing robot",
    description: "Gear up for RoboClimb, the ultimate test of innovation and engineering skill. This thrilling event challenges students to design and build all-terrain robots capable of navigating obstacles and tackling extreme conditions. It’s not just about mobility—it’s about creativity, precision, and teamwork. Whether you’re competing for the prize or the glory, RoboClimb is your chance to showcase technical brilliance and prove your robot’s dominance.",
    fee: "Rs. 200/-",
    type: "Visionary",
    coordinators: {
      faculty: [{ name: "Mr. Pavan Kumar", phone: "96116 40888" }],
      student: [
        { name: "Trupti", phone: "9380013688" },
        { name: "Meghana", phone: "8217397606" }
      ]
    },
    brochureUrl: "/Roboclimb rules.pdf"
  },
  {
    name: "Wind Rush",
    category: "Engineering and Design",
    subCategory: "wind turbine",
    description: "Wind Rush Challenge is a glider competition where: Participants must design, build, and fly a hand-launched foam glider that stays in the air as long as possible. The glider must be made only from foam and must be built before the event.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Mr. Adarsh Krishnamurthy", phone: "9900258871" }],
      student: [
        { name: "Swamini Arvind B", phone: "9110853761" },
        { name: "Haneesh", phone: "9986179062" }
      ]
    },
    brochureUrl: "/Windrush.pdf"
  },
  {
    name: "Scrapyard Wars",
    category: "Engineering and Design",
    subCategory: "scrap metal robot",
    description: "Unleash your creativity in this unique challenge where participants design and build a catapult using only scrapyard materials. The competition highlights innovation, practical mechanical design, and the art of making the best out of waste. Each catapult will be tested for performance, rewarding not just functionality but also originality and aesthetics. This event is the perfect blend of hands-on learning and engineering creativity.",
    fee: "Rs. 200/-",
    type: "Visionary",
    coordinators: {
      faculty: [{ name: "Dr. Ananth S. Iyengar", phone: "9480343844" }],
      student: [
        { name: "Ranganatha. K.", phone: "7483353883" },
        { name: "Akash. C. Y.", phone: "7996186641" }
      ]
    },
    brochureUrl: "/Scrapyard Wars.pdf"
  },
  {
    name: "Micro RC Plane",
    category: "Engineering and Design",
    subCategory: "rc plane",
    description: "Participants will design and build a lightweight but strong RC model with the given constraints and fly it through an obstacle course to score points and prove their design and piloting skills.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Jayahar Sivasubramanian", phone: "+91 7795701987" }],
      student: [
        { name: "Mihir Wankhade", phone: "9900570783" },
        { name: "Saraswathi", phone: "9886691575" }
      ]
    },
    brochureUrl: "/Micro RC Plane Build.pdf"
  },
  {
    name: "GreenPlan CAD",
    category: "Engineering and Design",
    subCategory: "eco friendly city",
    description: "GreenPlan CAD is a unique design challenge where budding civil engineers craft sustainable site layouts using AutoCAD. Participants must integrate eco-conscious solutions like rainwater harvesting, solar orientation, and green zones into their designs. This hands-on event sharpens creativity, space management, and drafting skills while encouraging innovative approaches to sustainable development.",
    fee: "Rs. 200/-",
    type: "Explorer",
    coordinators: {
      faculty: [{ name: "Mr. Eshwar Reddy H N", phone: "9845224428" }],
      student: [
        { name: "Abhilash", phone: "8618488065" },
        { name: "Kruthika B", phone: "8904994491" }
      ]
    },
    brochureUrl: "/GreenPlan CAD.pdf"
  },
  {
    name: "Air Crash Investigation",
    category: "Engineering and Design",
    subCategory: "plane crash",
    description: "Step into the role of an aviation investigator in this unique challenge! Teams will analyze a simulated aircraft accident case using real-world methods and data. Participants must review evidence, identify root causes, and propose preventive measures. After case analysis, shortlisted teams will present their investigation report to a jury of experts. The event sharpens analytical thinking, communication, and teamwork while offering a real-world taste of aviation safety practices.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Jayahar Sivasubramanian", phone: "7795701987" }],
      student: [
        { name: "Supriya", phone: "9901479264" },
        { name: "Manya", phone: "9235050505" }
      ]
    },
    brochureUrl: "/Air crash investigation.pdf"
  },

  // --- Research and Presentation ---
  {
    name: "ISTE Research Paper Presentation",
    category: "Research and Presentation",
    subCategory: "research presentation",
    description: "Unveil your innovation at the ISTE Research Paper Presentation—a premier platform for students and researchers to showcase original work before a panel of distinguished experts. Submissions are welcome across diverse domains including AI/ML, Cybersecurity, Robotics, Energy, Electrical, IoT, Biomedical Engineering, and especially interdisciplinary projects that break boundaries.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Mallaradhya H M", phone: "9742727670" }],
      student: [
        { name: "Mr. B Jagadish", phone: "9019497370" },
        { name: "Mr. Rishab R K", phone: "6360962848" }
      ]
    },
    brochureUrl: "/Research paper.pdf"
  },
  {
    name: "IEEE Project/Poster Presentation",
    category: "Research and Presentation",
    subCategory: "science fair",
    description: "A platform for individuals or teams to showcase innovative project-based solutions that address real-world societal or industrial problems.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Prajwal K T", phone: "9844660808" }],
      student: [
        { name: "Akshay PM", phone: "9686226622" },
        { name: "Sai Kiran", phone: "8088306200" }
      ]
    },
    brochureUrl: "/Project_Poster presentation.pdf"
  },
  {
    name: "Medical Tech Innovate",
    category: "Research and Presentation",
    subCategory: "medical technology",
    description: "Innovation in healthcare begins with fresh ideas. This event invites students to explore the intersection of medical sciences and technology by tackling realworld problem statements. Participants will brainstorm, design, and present their solutions through models, posters, or short videos, showcasing creativity, feasibility, and innovation. It’s a platform to collaborate, think critically, and bring impactful medical ideas closer to reality.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Soumya Ramani", phone: "8971790080" }],
      student: [
        { name: "Eesha brijesh", phone: "9148483111" },
        { name: "B V Aditya", phone: "8867064061" }
      ]
    },
    brochureUrl: "/Medical_Tech_innovate.pdf"
  },
  {
    name: "Dent-Tech",
    category: "Research and Presentation",
    subCategory: "dental technology",
    description: "The Ramaiah Dent-Tech Poster Event is a platform for budding dental innovators to showcase creative, practical, and impactful ideas that address real-world challenges in dentistry. Through poster and model presentations, students will pitch solutions that combine scientific knowledge, innovation, and entrepreneurial spirit. This event not only highlights academic creativity but also encourages participants to translate their ideas into potential advancements in dental science and technology.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Dominic Augustine", phone: "9901694515" }],
      student: [
        { name: "Ankush Chadichal", phone: "7975965514" },
        { name: "Gowuri Kishore", phone: "8073411261" }
      ]
    },
    brochureUrl: "/Dent Tech.pdf"
  },
  {
    name: "Pitch Pulse",
    category: "Research and Presentation",
    subCategory: "startup pitch",
    description: "Got a game-changing idea? Pitch Pulse is your stage to showcase it! Participants present innovative solutions to real-world problems in a high-energy 5-minute pitch before a panel of industry experts. The event offers more than just prizes— it’s a gateway to valuable feedback, mentorship, and networking opportunities. From technology and sustainability, to social impact, any impactful idea is welcome. Step up, pitch it, and kickstart your entrepreneurial journey!",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Kiran Kumar B M", phone: "9164644099" }],
      student: [
        { name: "Renuka", phone: "8147192405" },
        { name: "Samarth", phone: "9019353197" }
      ]
    },
    brochureUrl: "/Pitch_Pulse.pdf"
  },

  // --- Code and Compute ---
  {
    name: "Triathlon",
    category: "Code and Compute",
    subCategory: "coding challenge",
    description: "Triathlon is a three-round flagship event designed to test participants’ technical knowledge, problem-solving skills, and practical application of computer science concepts. The objective is to provide a holistic challenge that combines theory, practical hardware skills, and cybersecurity awareness making it a true triathlon of tech.",
    fee: "Rs. 200/-",
    type: "Visionary",
    coordinators: {
      faculty: [{ name: "Ms. M Shona", phone: "9986430996" }],
      student: [
        { name: "Sanjeev Janardhan", phone: "9632711818" },
        { name: "Sachin", phone: "7022730191" }
      ]
    },
    brochureUrl: "/Triathlon by Cynergy.pdf"
  },
  {
    name: "Feature Sleuths",
    category: "Code and Compute",
    subCategory: "code debugging",
    description: "Welcome to Feature Sleuth, a high-pressure data engineering showdown where the dataset takes center stage and the model is fixed. In a controlled lab setup, participants must craft powerful feature pipelines under strict time limits—going beyond basic cleaning to master scaling, encoding, dimensionality reduction, and advanced feature creation. With no AutoML or model tuning allowed, this event is the ultimate test of intuition, creativity, and technical execution in feature engineering.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Shaista Tarrunum", phone: "7760957304" }],
      student: [
        { name: "Isa Aminah", phone: "9482164889" },
        { name: "Sathvik S", phone: "6364485806" }
      ]
    },
    brochureUrl: "/Feature sleuths.pdf"
  },
  {
    name: "Relay Hackathon",
    category: "Code and Compute",
    subCategory: "team coding",
    description: "The Relay Hackathon is a fast-paced coding challenge that tests teamwork, speed, and creativity. In this unique relay format, each team member tackles a different task—debugging, treasure hunts, and web feature development— before passing the baton to the next. Submissions are made on GitHub after each round, ensuring real-time progress tracking.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Naganandini G Rao", phone: "8317307043" }],
      student: [
        { name: "Somya Jha", phone: "8448503999" },
        { name: "Shuchi", phone: "8951673031" }
      ]
    },
    brochureUrl: "/Relay hackathon Cynergy.pdf"
  },
  {
    name: "TechnoMaze",
    category: "Code and Compute",
    subCategory: "maze algorithm",
    description: "Step into the world of logic, speed, and strategy with TechnoMaze—a one-of-a-kind digital maze challenge! Only the sharpest problem-solvers will advance through each level, and the event culminates when the first three teams reach the final destination in the correct order. Are you ready to outthink, outpace, and outlast the maze?",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Sumanth Bharadwaj H S", phone: "9902727891" }],
      student: [
        { name: "Rishi", phone: "9449509081" },
        { name: "Jaisurya", phone: "8095457239" }
      ]
    },
    brochureUrl: "/Technomaze.pdf"
  },
  {
    name: "Skyhack",
    category: "Code and Compute",
    subCategory: "cyber security hacking",
    description: "SkyHack is a one-day hackathon where creativity meets technology. Participants must propose drone-based solutions to real-world challenges across domains like agriculture, logistics, and disaster response. The competition unfolds in three rounds: problem reveal & ideation, AI-powered drone design with pitch deck creation, and a final pitch to the jury. No coding is required— only innovation, design thinking, and clear communication.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Kiran Kumar B M", phone: "9164644099" }],
      student: [
        { name: "Rathan Raj", phone: "6363548034" },
        { name: "Shriharsha", phone: "9902895047" }
      ]
    },
    brochureUrl: "/Skyhack.pdf"
  },
  {
    name: "Codelogik",
    category: "Code and Compute",
    subCategory: "logic puzzle",
    description: "This event challenges participants to solve coding problems rooted in core and advanced mathematics, bridging theoretical knowledge with real-world programming. By tackling diverse challenges, participants sharpen analytical thinking, enhance algorithmic creativity, and develop efficient problem-solving strategies, making it a perfect blend of logic, math, and code.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Shilpa", phone: "9071290398" }],
      student: [
        { name: "Dharanesh", phone: "8951454362" },
        { name: "Umashankar", phone: "8940813666" }
      ]
    },
    brochureUrl: "/Codelogik.pdf"
  },
  {
    name: "Synth Vision Arena",
    category: "Code and Compute",
    subCategory: "computer vision",
    description: "Welcome to SynthVision Arena, a real-time generative engineering gauntlet. This live competition challenges teams to architect and execute complex generative workflows in response to dynamic, on-the-fly prompts.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Padma R", phone: "7259569405" }],
      student: [
        { name: "Daksha Subramanya", phone: "9353316112" },
        { name: "Sudeep S Suvarna", phone: "8217807088" }
      ]
    },
    brochureUrl: "/Synth Vision Arena.pdf"
  },
  {
    name: "Modelkraft",
    category: "Code and Compute",
    subCategory: "machine learning model",
    description: "This event challenges participants to apply machine learning to real-world data by building predictive models for a given target variable. Through hands-on work in preprocessing, feature engineering, model selection, and optimization, participants sharpen their technical and problem-solving skills. Models are evaluated on a hidden test set to ensure fairness and true generalization, fostering critical thinking, creativity, and practical expertise in data-driven decision-making.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Praneetha", phone: "7411935429" }],
      student: [
        { name: "Pranava", phone: "6362072678" },
        { name: "Jemi", phone: "9426593156" }
      ]
    },
    brochureUrl: "/Modelkraft.pdf"
  },

  // --- Enterprise and Expression ---
  {
    name: "The Quantum Quest",
    category: "Enterprise and Expression",
    subCategory: "quantum physics",
    description: "What lies at the intersection of paths built by words and the knowledge of humans? Whether you seek the treasure or find the thrill in solving riddles, The Quantum Quest is a treasure hunt that entangles you in one game, with many riddles. Seek a path from the intersection of the first riddle but fret not for the roads diverge and converge… all roads lead to Rome. And once the winner arises, the game doesn’t end for there are champions three. And everyone shall have chance to be one of the two: the treasure seeker, and the thrill seeker. Both shall stand besides the winner. But there is no promise that there being only three treasures is the truth or a lie, when sure sees trinkets as treasure a seeker’s eye.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. V Preethi", phone: "8884952429" }],
      student: [
        { name: "Jeyani Shekar", phone: "9686690359" },
        { name: "Sathwik K", phone: "9566450949" }
      ]
    },
    brochureUrl: "/The Quantum Quest.pdf"
  },
  {
    name: "Beyond the Blueprint",
    category: "Enterprise and Expression",
    subCategory: "architecture design",
    description: "Think you’ve got what it takes to solve real problems? Beyond The Blueprint is your chance to pitch them in a 5-minute presentation before a panel of industry experts. Win prizes, gain feedback, and connect with mentors who can help turn your vision into reality. From tech and sustainability to social impact and beyond—this is your launchpad to make an impact.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Mueen Ahmed", phone: "8050753395" }],
      student: [
        { name: "Sankalp", phone: "7090475089" },
        { name: "Amruth", phone: "7406323722" }
      ]
    },
    brochureUrl: "/Beyond the blueprint.pdf"
  },
  {
    name: "Cause & Consequence",
    category: "Enterprise and Expression",
    subCategory: "case study",
    description: "The Causes and Consequences is a thought-provoking debate that pushes participants to tackle bold “what if” scenarios in science, technology, and society. Through IF…THEN statements, speakers must combine technical insight, ethical reasoning, and persuasive delivery to defend or dismantle complex ideas with clarity, creativity, and conviction.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Ms. Farhat Begum", phone: "9986001297" }],
      student: [
        { name: "Shruti", phone: "8296524204" },
        { name: "Srujana", phone: "6303320655" }
      ]
    },
    brochureUrl: "/Cause&Consequence.pdf"
  },
  {
    name: "Campus Innovators",
    category: "Enterprise and Expression",
    subCategory: "student innovation",
    description: "Campus Innovators is your platform to pitch bold solutions for campus challenges, aligned with the UN Sustainable Development Goals (SDGs). In this fast-paced competition, participants will pitch their ideas in 5 minutes to a panel of industry experts, showcasing innovation, feasibility, and real-world impact. From tech breakthroughs to sustainability initiatives to social innovations, the event empowers students to reimagine campus life and spark meaningful change.",
    fee: "Rs. 200/-",
    type: "Explorer",
    coordinators: {
      faculty: [],
      student: [
        { name: "Akul", phone: "8547067060" },
        { name: "Revanth", phone: "8247391129" }
      ]
    },
    brochureUrl: "/Campus innovators.pdf"
  },
  {
    name: "Boardroom Battles",
    category: "Enterprise and Expression",
    subCategory: "business meeting",
    description: "Boardroom Battles – Strategic Leadership Cohort is a high-intensity leadership simulation where participants step into C-suite roles and tackle real-world inspired business or sustainability crises. The event unfolds in stages—briefing & role assignment, strategy formulation, boardroom presentations, and a dynamic crossfire debate. With unexpected twists, live scrutiny from experts, and pressure to make tough calls, participants will experience what it takes to lead at the highest level.",
    fee: "Rs. 200/-",
    type: "Creator",
    coordinators: {
      faculty: [{ name: "Dr. Subhadeep Mukherjee", phone: "8910133283" }],
      student: [
        { name: "Abhijit Arya", phone: "8018375553" },
        { name: "Ismail", phone: "6366153335" }
      ]
    },
    brochureUrl: "/Boardroom battles.pdf"
  }
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
