import "server-only";
import { randomBytes } from "crypto";
import { TEAM_CODE_LENGTH } from "@/lib/teams";

/** No 0/O, 1/I: codes are read off a phone and typed in by hand. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A fresh team join code. Shared by the teams API, where students make
    teams, and the import of teams entered on other platforms. */
export function generateTeamCode() {
  const bytes = randomBytes(TEAM_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < TEAM_CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
