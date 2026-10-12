import { describe, it, expect, vi, beforeEach } from "vitest";
import { decideStamp } from "@/lib/checkin";
import type { Application } from "@/lib/applications";

const fake = vi.hoisted(() => {
  const rows = new Map<string, string>();
  let tail: Promise<void> = Promise.resolve();
  return {
    rows,
    getConnection() {
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const prev = tail;
      tail = gate;
      return {
        async beginTransaction() {
          await prev;
        },
        async execute(sql: string, params: unknown[] = []) {
          if (sql.includes("FOR UPDATE")) {
            const data = rows.get(String(params[0]));
            return [data ? [{ data }] : []];
          }
          if (sql.startsWith("UPDATE")) {
            rows.set(String(params[1]), String(params[0]));
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("INSERT")) {
            rows.set(String(params[0]), String(params[1]));
            return [{ affectedRows: 1 }];
          }
          return [[]];
        },
        async commit() {
          release();
        },
        async rollback() {
          release();
        },
        release() {},
      };
    },
  };
});

vi.mock("mysql2/promise", () => {
  const pool = { getConnection: () => fake.getConnection(), end: async () => {} };
  return { default: { createPool: () => pool }, createPool: () => pool };
});

import { sqlCasUpdate } from "@/lib/sql-store";

const base = (): Application => ({
  ticketId: "PRV-1",
  eventId: "robo-climb",
  eventName: "Robo Climb",
  status: "confirmed",
  payment: "paid",
  fee: "Rs. 200/-",
  name: "Asha",
  email: "asha@example.com",
  phone: "9876543210",
  college: "RUAS",
  teamName: null,
  members: null,
  appliedAt: "2026-10-01T00:00:00.000Z",
});

beforeEach(() => {
  fake.rows.clear();
  process.env.MYSQL_HOST = "h";
  process.env.MYSQL_DATABASE = "d";
  process.env.MYSQL_USER = "u";
  process.env.MYSQL_PASSWORD = "p";
});

describe("sqlCasUpdate", () => {
  it("lets only one of two overlapping scans stamp the row", async () => {
    const path = "app/robo-climb/asha.json";
    fake.rows.set(path, JSON.stringify(base()));
    const once = (actor: string, at: string) =>
      sqlCasUpdate<Application>(path, async (current) => {
        await new Promise((r) => setTimeout(r, 30));
        const decision = decideStamp(current, actor, at);
        return { write: decision.write, next: decision.write ? decision.next : current };
      });
    const [a, b] = await Promise.all([
      once("a@x", "2026-10-14T04:00:00.000Z"),
      once("b@x", "2026-10-14T04:00:01.000Z"),
    ]);
    expect([a.written, b.written].filter(Boolean)).toHaveLength(1);
    const saved = JSON.parse(fake.rows.get(path)!) as Application;
    expect(saved.checkedInAt).toBeTruthy();
    const winner = a.written ? "a@x" : "b@x";
    expect(saved.checkedInBy).toBe(winner);
  });
});
