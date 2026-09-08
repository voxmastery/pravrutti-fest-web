/**
 * The brand palette for code that can't use a Tailwind class: SVG gradient
 * stops, canvas/three materials, inline style objects, chart series.
 *
 * Same values as the tokens in app/globals.css `:root` — change both together.
 * Components never write a hex literal; they import from here.
 */
export const PALETTE = {
  voidBlack: "#000000",
  midnightNavy: "#0A0818",
  cosmicPurple: "#150B1E",
  deepPlum: "#2B122C",
  royalWine: "#4A1C3A",
  neonPurple: "#721F4C",
  electricMagenta: "#AC355D",
  cyberPink: "#D64D8D",
  cyberPinkLight: "#ECA8D6",
  champagneGold: "#F2D2AE",
  softGold: "#BF8A1B",
  warmBronze: "#B68A67",
  pearlWhite: "#F7EEE4",
  success: "#12B76A",
  successSoft: "#7BE3A8",
  danger: "#F87171",
} as const;

export type PaletteKey = keyof typeof PALETTE;
