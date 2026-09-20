/**
 * What happens when somebody taps "Yes, I've paid".
 *
 * The Transaction Reference No is optional — a gate on it is what lost the
 * first twenty-two registrations — but it is worth one firm ask. So an empty
 * field gets a single interstitial ("paste it, or continue without"), and the
 * second tap goes through either way. A typed value that cannot be a
 * reference is told so rather than silently dropped.
 */
export type AfterYes =
  | { kind: "invalid" }
  | { kind: "nudge" }
  | { kind: "submit"; withReference: boolean };

export function afterYesPressed(
  typed: string,
  alreadyNudged: boolean,
  isValid: (ref: string) => boolean,
): AfterYes {
  const ref = typed.trim();
  if (ref && !isValid(ref)) return { kind: "invalid" };
  if (!ref && !alreadyNudged) return { kind: "nudge" };
  return { kind: "submit", withReference: ref.length > 0 };
}
