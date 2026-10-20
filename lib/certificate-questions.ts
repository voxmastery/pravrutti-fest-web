/**
 * The feedback form, in one place.
 *
 * The ticket dialog, the validator, the stored JSON keys, and the coordinator
 * export all read this array. Replacing a question means editing it here —
 * the table does not have a column per question, so a new prompt does not
 * need a schema change. Old answers stay under the id they were saved with.
 */

export type CertificateChoice = { value: string; label: string };

export type CertificateQuestion = {
  id: string;
  /** Shown to the participant. */
  prompt: string;
  /** Short heading for the coordinator table. */
  column: string;
  required: boolean;
} & (
  | { kind: "choice"; options: CertificateChoice[] }
  | { kind: "short" | "paragraph"; placeholder?: string; maxLength: number }
);

const RATING: CertificateChoice[] = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "average", label: "Average" },
  { value: "needs_improvement", label: "Needs Improvement" },
];

export const CERTIFICATE_QUESTIONS: CertificateQuestion[] = [
  {
    id: "overall",
    prompt: "How would you rate your overall experience at Pravrutti 2.0?",
    column: "Overall",
    kind: "choice",
    required: true,
    options: [
      { value: "excellent", label: "⭐ Excellent" },
      { value: "good", label: "😊 Good" },
      { value: "average", label: "😐 Average" },
      { value: "needs_improvement", label: "🙁 Needs Improvement" },
    ],
  },
  {
    id: "events",
    prompt: "How would you rate the events and activities?",
    column: "Events",
    kind: "choice",
    required: true,
    options: RATING,
  },
  {
    id: "organization",
    prompt: "How was the overall organization and management?",
    column: "Organisation",
    kind: "choice",
    required: true,
    options: RATING,
  },
  {
    id: "enjoyed",
    prompt: "What did you enjoy the most at Pravrutti 2.0?",
    column: "Enjoyed most",
    kind: "short",
    required: true,
    placeholder: "A session, a team, the venue…",
    maxLength: 400,
  },
  {
    id: "improve",
    prompt: "What could we improve for the next edition?",
    column: "Improve",
    kind: "short",
    required: false,
    placeholder: "Optional",
    maxLength: 400,
  },
  {
    id: "next",
    prompt: "Would you love to be a part of the next Pravrutti?",
    column: "Next Pravrutti",
    kind: "choice",
    required: true,
    options: [
      { value: "definitely", label: "Definitely!" },
      { value: "maybe", label: "Maybe" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "comments",
    prompt: "Share any additional feedback or suggestions.",
    column: "Suggestions",
    kind: "paragraph",
    required: false,
    placeholder: "Optional",
    maxLength: 2000,
  },
];

export type CertificateAnswers = Record<string, string>;

export function answerLabel(id: string, value: string): string {
  const question = CERTIFICATE_QUESTIONS.find((q) => q.id === id);
  if (!question || question.kind !== "choice") return value;
  return question.options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Accepts only the questions in `CERTIFICATE_QUESTIONS`. A name, an email, or
 * any other field in the same object is ignored — the certificate name comes
 * from the signed-in person's registration, never from this payload.
 */
export function parseCertificateAnswers(
  raw: unknown,
): { ok: true; answers: CertificateAnswers } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "The feedback wasn't readable." };
  }
  const bag = raw as Record<string, unknown>;
  const answers: CertificateAnswers = {};

  for (const question of CERTIFICATE_QUESTIONS) {
    const value = bag[question.id];
    if (question.kind === "choice") {
      const picked = typeof value === "string" ? value : "";
      const known = question.options.some((o) => o.value === picked);
      if (!known) {
        if (!question.required && (value == null || picked === "")) continue;
        return { ok: false, error: `Choose an answer for “${question.prompt}”` };
      }
      answers[question.id] = picked;
      continue;
    }

    const text = readText(value, question.kind === "paragraph");
    if (!text) {
      if (question.required) return { ok: false, error: `Please answer “${question.prompt}”` };
      continue;
    }
    if (text.length > question.maxLength) {
      return { ok: false, error: `“${question.prompt}” is too long.` };
    }
    answers[question.id] = text;
  }

  return { ok: true, answers };
}

function readText(value: unknown, paragraph: boolean): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!paragraph) return trimmed.replace(/\s+/g, " ");
  return trimmed.replace(/\r\n/g, "\n");
}
