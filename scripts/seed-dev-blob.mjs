/**
 * Fills the local .dev-blob store with fake registrations.
 *
 * The dashboards are hard to judge empty — you cannot tell whether counts,
 * statuses and check-in times read well until there are rows. Names here are
 * obviously invented so nothing is ever mistaken for a real participant.
 *
 *   node scripts/seed-dev-blob.mjs
 */
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

const ROOT = path.join(process.cwd(), ".dev-blob");

const FIRST = ["Aarav", "Diya", "Rohan", "Ananya", "Vikram", "Meera", "Karthik", "Sneha",
  "Arjun", "Priya", "Nikhil", "Kavya", "Rahul", "Ishita", "Aditya", "Tanvi"];
const LAST = ["Sharma", "Nair", "Reddy", "Iyer", "Gupta", "Menon", "Rao", "Bose"];
const COLLEGES = ["RUAS", "RVCE", "PES University", "BMSCE", "MSRIT", "Christ University",
  "NITK Surathkal", "Jain University"];

// Deterministic so re-running gives the same roster instead of churn.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rand() * a.length)];

const key = (eventId, email) =>
  createHash("sha256").update(`${eventId}:${email.toLowerCase()}`).digest("hex").slice(0, 24);

async function write(pathname, data) {
  const file = path.join(ROOT, ...pathname.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

const src = await fs.readFile("lib/pravrutti-data.ts", "utf8");
const events = [...src.matchAll(/^    name: "(.+?)",$/gm)]
  .map((m) => m[1])
  .map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));

// The events array starts after the sponsors/clubs blocks; take the last 24.
const eventIds = events.slice(-24);

let total = 0;
for (const eventId of eventIds) {
  const n = 3 + Math.floor(rand() * 10); // 3–12 applicants per event
  for (let i = 0; i < n; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@example.com`;
    const r = rand();
    // Roughly: 60% confirmed, 25% pending, 15% declined.
    const status = r < 0.6 ? "confirmed" : r < 0.85 ? "pending" : "declined";
    // Only confirmed people can be checked in — the scanner rejects the rest.
    const checkedIn = status === "confirmed" && rand() < 0.45;

    await write(`app/${eventId}/${key(eventId, email)}.json`, {
      ticketId: key(eventId, email),
      eventId,
      eventName: eventId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      name,
      email,
      phone: `9${Math.floor(100000000 + rand() * 899999999)}`,
      college: pick(COLLEGES),
      status,
      createdAt: new Date(Date.UTC(2026, 8, 1 + Math.floor(rand() * 25))).toISOString(),
      checkedInAt: checkedIn
        ? new Date(Date.UTC(2026, 9, 15, 9 + Math.floor(rand() * 6), Math.floor(rand() * 60))).toISOString()
        : undefined,
      checkedInBy: checkedIn ? "voxmastery@gmail.com" : undefined,
    });
    total++;
  }
}

console.log(`seeded ${total} applications across ${eventIds.length} events -> .dev-blob/`);
