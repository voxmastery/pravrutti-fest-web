/**
 * Turns an event description into an optional intro plus a list of bullets.
 *
 * Coordinators write these in a Google Form, and several paste bullets as
 * literal "●" characters *inline* — mid-sentence, not on their own line — so
 * splitting on newlines alone would miss every one of them and the page would
 * show a run-on paragraph with stray dots in it.
 *
 * A description with no markers comes back as intro-only, so the twenty events
 * that are plain prose render exactly as they did before.
 */
export type ParsedDescription = { intro: string | null; bullets: string[] };

/* "●" and "•" anywhere, or a "-"/"*" that begins a line. A bare hyphen
   mid-sentence is a dash or a hyphenated word, never a bullet — matching one
   would shred sentences like "a load-bearing bridge - then test it". */
const MARKER = /[●•]|(?:^|\n)\s*[-*]\s+/;
const MARKER_G = new RegExp(MARKER.source, "g");

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseDescription(raw: string): ParsedDescription {
  const text = String(raw ?? "");
  if (!MARKER.test(text)) return { intro: tidy(text) || null, bullets: [] };

  const parts = text.split(MARKER_G).map(tidy).filter(Boolean);
  if (parts.length === 0) return { intro: null, bullets: [] };

  // Anything before the first marker is the lead-in; the rest are bullets.
  const startsWithMarker = /^\s*(?:[●•]|[-*]\s)/.test(text);
  const intro = startsWithMarker ? null : parts[0];
  const bullets = startsWithMarker ? parts : parts.slice(1);
  return { intro, bullets };
}
