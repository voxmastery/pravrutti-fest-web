import "server-only";
import { sqlEnabled, sqlExecute, sqlQuery } from "@/lib/sql-store";

/**
 * One row per participant, and the only table this feature writes.
 *
 * Check-in, tickets, and teams are read elsewhere and never updated here.
 * A second submit does not overwrite: INSERT IGNORE keeps the first answers,
 * and a later download only reads the row.
 */

export const CERTIFICATE_FEEDBACK_TABLE = "certificate_feedback";

export const CERTIFICATE_FEEDBACK_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS \`${CERTIFICATE_FEEDBACK_TABLE}\` (
     email VARCHAR(191) NOT NULL,
     name VARCHAR(191) NOT NULL,
     answers LONGTEXT NOT NULL,
     submitted_at VARCHAR(40) NOT NULL,
     PRIMARY KEY (email)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const CERTIFICATE_FEEDBACK_INSERT =
  `INSERT IGNORE INTO \`${CERTIFICATE_FEEDBACK_TABLE}\` (email, name, answers, submitted_at) VALUES (?, ?, ?, ?)`;

export type FeedbackRow = {
  email: string;
  name: string;
  answers: Record<string, string>;
  submittedAt: string;
};

export type FeedbackStore = {
  get(email: string): Promise<FeedbackRow | null>;
  /** Inserts only when this email has no row yet. The first answers win. */
  insertOnce(row: FeedbackRow): Promise<{ row: FeedbackRow; created: boolean }>;
  list(): Promise<FeedbackRow[]>;
};

let ensuring: Promise<void> | null = null;

export function ensureCertificateFeedbackTable(): Promise<void> {
  if (!sqlEnabled()) return Promise.resolve();
  if (!ensuring) {
    ensuring = sqlQuery(CERTIFICATE_FEEDBACK_TABLE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensuring = null;
        throw err;
      });
  }
  return ensuring;
}

function parseRow(row: { email: string; name: string; answers: string; submitted_at: string }): FeedbackRow | null {
  if (!row?.email) return null;
  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.answers);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") answers[key] = value;
      }
    }
  } catch {
    answers = {};
  }
  return {
    email: String(row.email).toLowerCase(),
    name: String(row.name ?? ""),
    answers,
    submittedAt: String(row.submitted_at ?? ""),
  };
}

export function createMemoryFeedbackStore(): FeedbackStore {
  const rows = new Map<string, FeedbackRow>();
  return {
    async get(email) {
      return rows.get(email.trim().toLowerCase()) ?? null;
    },
    async insertOnce(row) {
      const email = row.email.trim().toLowerCase();
      const prev = rows.get(email);
      if (prev) return { row: prev, created: false };
      const stored = { ...row, email, answers: { ...row.answers } };
      rows.set(email, stored);
      return { row: stored, created: true };
    },
    async list() {
      return [...rows.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    },
  };
}

export function sqlFeedbackStore(): FeedbackStore {
  return {
    async get(email) {
      await ensureCertificateFeedbackTable();
      const [rows] = (await sqlExecute(
        `SELECT email, name, answers, submitted_at FROM \`${CERTIFICATE_FEEDBACK_TABLE}\` WHERE email = ?`,
        [email.trim().toLowerCase()],
      )) as [Array<{ email: string; name: string; answers: string; submitted_at: string }>, unknown];
      return parseRow(rows?.[0]);
    },
    async insertOnce(row) {
      await ensureCertificateFeedbackTable();
      const email = row.email.trim().toLowerCase();
      const [res] = (await sqlExecute(CERTIFICATE_FEEDBACK_INSERT, [
        email,
        row.name.slice(0, 191),
        JSON.stringify(row.answers),
        row.submittedAt,
      ])) as [{ affectedRows?: number }, unknown];
      const stored = await this.get(email);
      if (!stored) throw new Error("Feedback could not be saved.");
      return { row: stored, created: Number(res?.affectedRows ?? 0) > 0 };
    },
    async list() {
      await ensureCertificateFeedbackTable();
      const [rows] = (await sqlExecute(
        `SELECT email, name, answers, submitted_at FROM \`${CERTIFICATE_FEEDBACK_TABLE}\` ORDER BY submitted_at DESC`,
        [],
      )) as [Array<{ email: string; name: string; answers: string; submitted_at: string }>, unknown];
      return (rows ?? []).map(parseRow).filter((r): r is FeedbackRow => !!r);
    },
  };
}

export function feedbackStore(): FeedbackStore {
  return sqlFeedbackStore();
}
