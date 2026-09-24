import type { FacultyTeam } from "@/lib/faculty-board";

/**
 * Flags registrations that look like tests rather than students.
 *
 * Only a flag, never a verdict: this feeds a list a human reads, and nothing
 * is removed on its say-so. The demo accounts the organisers cleaned up had
 * team names like "Hehe", "Hhnwmdj" and "Bdsbrbe" — keyboard mashes — so that
 * is the main signal, with a few cheaper ones beside it.
 */

const WORDS = /\b(test|testing|demo|dummy|sample|fake|asdf|qwer|abc|xyz|hehe|haha|lol|temp|trial|check)\b/i;
const MASH_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function vowelRatio(s: string) {
  const letters = s.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return 1;
  return (letters.match(/[aeiouy]/g)?.length ?? 0) / letters.length;
}

/** "Hhnwmdj", "Bdsbrbe", "sdfgh", "aaaa". Short real words pass. */
export function looksLikeMash(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  const letters = s.replace(/[^a-z]/g, "");
  if (letters.length < 3) return false;
  if (/(.)\1{2,}/.test(letters)) return true; // "aaa", "hhhh"
  if (new Set(letters).size <= 2 && letters.length >= 4) return true; // "hehe", "abab"
  if (letters.length >= 5 && vowelRatio(letters) < 0.2) return true; // "hhnwmdj", "bdsbrbe"
  for (const row of MASH_ROWS)
    for (let i = 0; i + 4 <= row.length; i++) if (letters.includes(row.slice(i, i + 4))) return true;
  return false;
}

const FAKE_PHONES = /^(\d)\1{9}$|^(1234567890|0123456789|9876543210)$/;

export type Suspect = { team: FacultyTeam; reasons: string[] };

export function suspectReasons(t: FacultyTeam): string[] {
  const reasons: string[] = [];
  if (t.name && (WORDS.test(t.name) || looksLikeMash(t.name))) reasons.push(`team name "${t.name}"`);
  for (const p of t.people) {
    if (WORDS.test(p.name) || looksLikeMash(p.name)) reasons.push(`person name "${p.name}"`);
    if (/\b(test|demo|dummy|fake)\b/i.test(p.email.split("@")[0])) reasons.push(`email ${p.email}`);
    if (FAKE_PHONES.test(p.phone)) reasons.push(`phone ${p.phone}`);
    // Words only: college acronyms (JSSSTU, BMSCE) trip the mash rules.
    if (p.college && WORDS.test(p.college)) reasons.push(`college "${p.college}"`);
  }
  return [...new Set(reasons)];
}

export function findSuspects(teams: FacultyTeam[]): Suspect[] {
  return teams.map((team) => ({ team, reasons: suspectReasons(team) })).filter((s) => s.reasons.length > 0);
}
