# Coordinator and Organiser Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each event's coordinators an observe-only dashboard for their own event, and give organisers a dashboard with QR check-in, replacing the shared admin password with Google sign-in.

**Architecture:** A single server-side `resolveRole()` derives role from the signed-in Google email on every request; no route trusts a client-supplied role or event id. Check-in is new: two optional fields on `Application`, an idempotent `POST /api/checkin`, and a phone camera scanner. The coordinator roster endpoint projects applications down to four fields before serialising, so contact details cannot leave the server by that route.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Vercel Blob, NextAuth (Google), Vitest (added in Task 1), `@zxing/browser` (added in Task 7).

**Spec:** `docs/superpowers/specs/2026-08-29-dashboards-design.md`

## Global Constraints

- Role is resolved **server-side on every request** from the session via `resolveEmail()`. Never accept a role, email, or event scope from the client.
- Coordinator responses must contain **no** `email` or `phone` key for any participant. Enforced by projection at the source, not by UI omission.
- `checkedInAt` and `checkedInBy` are **optional** on `Application` — the 10 existing production records must stay valid with no migration.
- Check-in is **idempotent**: a second scan never overwrites the original timestamp.
- Blob has no compare-and-swap. Never `read → mutate array → write` a shared record. Write per-entity keys.
- Existing blob helpers live in `lib/blob-store.ts`: `readJsonByPath`, `putJson`, `listAll`, `applicationPath`. Reuse them.
- Organiser emails come from `ORGANISER_EMAILS` (comma-separated env var), lowercased and trimmed before comparison.
- All emails are compared **lowercased**. `resolveEmail()` already lowercases; do the same for env and data values.

---

### Task 1: Test infrastructure

There is no test runner in this repo. Every later task is TDD, so this comes first.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Test: `test/sanity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest; `@/` path alias resolves in tests

- [ ] **Step 1: Install Vitest**

```bash
cd /home/voxmastery/Desktop/fest-web
npm install -D vitest@^2 @vitest/coverage-v8@^2
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Create `test/setup.ts`**

```ts
// Env the modules under test read at import time.
process.env.ORGANISER_EMAILS = "boss@pravrutti.test, second@pravrutti.test";
```

- [ ] **Step 5: Write the sanity test**

Create `test/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eventId } from "@/lib/pravrutti-data";

describe("test harness", () => {
  it("resolves the @ alias into lib", () => {
    expect(eventId("Robo Climb")).toBe("robo-climb");
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/
git commit -m "test: add vitest harness

No test runner existed. Every dashboard task is TDD, so this lands first."
```

---

### Task 2: Coordinator emails on Event

**Files:**
- Modify: `lib/pravrutti-data.ts` (the `Event` interface, ~line 17-27)
- Test: `test/roles.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Event.coordinators?: string[]` — lowercase Google emails allowed to view that event

- [ ] **Step 1: Write the failing test**

Create `test/roles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { events, eventId } from "@/lib/pravrutti-data";

describe("Event.coordinators", () => {
  it("is optional and absent until the spreadsheet lands", () => {
    const e = events.find((x) => eventId(x.name) === "electroxcape")!;
    expect(e).toBeDefined();
    expect(e.coordinators ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/roles.test.ts`
Expected: FAIL — `Property 'coordinators' does not exist on type 'Event'`.

- [ ] **Step 3: Add the field**

In `lib/pravrutti-data.ts`, inside `export interface Event`, after `poster?: string;`:

```ts
  /** Google emails allowed to view this event's dashboard. Lowercase.
      Populated from the collection spreadsheet; empty until it returns. */
  coordinators?: string[];
```

- [ ] **Step 4: Run it**

Run: `npx vitest run test/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pravrutti-data.ts test/roles.test.ts
git commit -m "feat(data): add Event.coordinators for dashboard access"
```

---

### Task 3: Role resolution

**Files:**
- Create: `lib/roles.ts`
- Test: `test/roles.test.ts` (extend)

**Interfaces:**
- Consumes: `Event.coordinators` (Task 2); `resolveEmail()` from `lib/identity`
- Produces:
  - `type Role = { kind: "organiser" } | { kind: "coordinator"; eventIds: string[] } | { kind: "none" }`
  - `roleForEmail(email: string | null): Role`
  - `resolveRole(): Promise<Role>`
  - `canViewEvent(role: Role, evId: string): boolean`

- [ ] **Step 1: Write the failing tests**

Append to `test/roles.test.ts`:

```ts
import { roleForEmail, canViewEvent } from "@/lib/roles";

describe("roleForEmail", () => {
  it("returns organiser for an ORGANISER_EMAILS entry", () => {
    expect(roleForEmail("boss@pravrutti.test")).toEqual({ kind: "organiser" });
  });

  it("is case-insensitive", () => {
    expect(roleForEmail("BOSS@Pravrutti.TEST")).toEqual({ kind: "organiser" });
  });

  it("returns none for an unknown email", () => {
    expect(roleForEmail("stranger@example.com")).toEqual({ kind: "none" });
  });

  it("returns none for null", () => {
    expect(roleForEmail(null)).toEqual({ kind: "none" });
  });
});

describe("canViewEvent", () => {
  it("lets an organiser view any event", () => {
    expect(canViewEvent({ kind: "organiser" }, "robo-climb")).toBe(true);
  });

  it("lets a coordinator view only their own events", () => {
    const role = { kind: "coordinator" as const, eventIds: ["robo-climb"] };
    expect(canViewEvent(role, "robo-climb")).toBe(true);
    expect(canViewEvent(role, "skycraft")).toBe(false);
  });

  it("denies a roleless account", () => {
    expect(canViewEvent({ kind: "none" }, "robo-climb")).toBe(false);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run test/roles.test.ts`
Expected: FAIL — cannot resolve `@/lib/roles`.

- [ ] **Step 3: Implement**

Create `lib/roles.ts`:

```ts
import { events, eventId } from "@/lib/pravrutti-data";
import { resolveEmail } from "@/lib/identity";

export type Role =
  | { kind: "organiser" }
  | { kind: "coordinator"; eventIds: string[] }
  | { kind: "none" };

const norm = (s: string) => s.trim().toLowerCase();

function organiserEmails(): string[] {
  return (process.env.ORGANISER_EMAILS ?? "")
    .split(",")
    .map(norm)
    .filter(Boolean);
}

/**
 * Pure so it can be tested without a session. Never call with a
 * client-supplied address — only with the value from resolveEmail().
 */
export function roleForEmail(email: string | null): Role {
  if (!email) return { kind: "none" };
  const who = norm(email);

  if (organiserEmails().includes(who)) return { kind: "organiser" };

  const eventIds = events
    .filter((e) => (e.coordinators ?? []).some((c) => norm(c) === who))
    .map((e) => eventId(e.name));

  return eventIds.length > 0 ? { kind: "coordinator", eventIds } : { kind: "none" };
}

/** Resolves from the session. The only role source any route may use. */
export async function resolveRole(): Promise<Role> {
  return roleForEmail(await resolveEmail());
}

export function canViewEvent(role: Role, evId: string): boolean {
  if (role.kind === "organiser") return true;
  if (role.kind === "coordinator") return role.eventIds.includes(evId);
  return false;
}
```

- [ ] **Step 4: Run them**

Run: `npx vitest run test/roles.test.ts`
Expected: PASS, all 8.

- [ ] **Step 5: Commit**

```bash
git add lib/roles.ts test/roles.test.ts
git commit -m "feat(roles): server-side role resolution from signed-in email"
```

---

### Task 4: Check-in fields on Application

**Files:**
- Modify: `lib/applications.ts` (the `Application` type, ~line 33-52)
- Test: `test/checkin-payload.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Application.checkedInAt?: string`, `Application.checkedInBy?: string`

- [ ] **Step 1: Write the failing test**

Create `test/checkin-payload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Application } from "@/lib/applications";

describe("Application check-in fields", () => {
  it("accepts a record with no check-in fields (existing production data)", () => {
    const a: Application = {
      ticketId: "PRV-AAAA1111",
      eventId: "robo-climb",
      eventName: "Robo Climb",
      status: "confirmed",
      payment: "not_required",
      fee: "Free",
      name: "Asha",
      email: "asha@example.com",
      phone: "9876543210",
      college: "RUAS",
      teamName: null,
      members: null,
      appliedAt: "2026-09-01T10:00:00.000Z",
    };
    expect(a.checkedInAt).toBeUndefined();
  });

  it("accepts a checked-in record", () => {
    const a: Partial<Application> = {
      checkedInAt: "2026-10-15T04:42:00.000Z",
      checkedInBy: "boss@pravrutti.test",
    };
    expect(a.checkedInBy).toBe("boss@pravrutti.test");
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/checkin-payload.test.ts`
Expected: FAIL — `'checkedInAt' does not exist in type 'Application'`.

- [ ] **Step 3: Add the fields**

In `lib/applications.ts`, inside `export type Application`, after `refundedAt?: string;`:

```ts
  /** Set once when an organiser scans this ticket. Never overwritten —
      a second scan reports the original time rather than replacing it. */
  checkedInAt?: string;
  /** Organiser email that performed the scan. */
  checkedInBy?: string;
```

- [ ] **Step 4: Run it**

Run: `npx vitest run test/checkin-payload.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/applications.ts test/checkin-payload.test.ts
git commit -m "feat(applications): add optional check-in fields"
```

---

### Task 5: QR payload parsing

The QR is generated in `app/api/status/route.ts` as `` `${r.ticketId}|${r.eventId}|${r.email}` ``. Parsing lives on its own so it can be tested without a request.

**Files:**
- Create: `lib/checkin.ts`
- Test: `test/checkin-payload.test.ts` (extend)

**Interfaces:**
- Consumes: nothing
- Produces: `parseTicketPayload(raw: string): { ticketId: string; eventId: string; email: string } | null`

- [ ] **Step 1: Write the failing tests**

Append to `test/checkin-payload.test.ts`:

```ts
import { parseTicketPayload } from "@/lib/checkin";

describe("parseTicketPayload", () => {
  it("parses a well-formed payload", () => {
    expect(parseTicketPayload("PRV-AB12CD34|robo-climb|Asha@Example.com")).toEqual({
      ticketId: "PRV-AB12CD34",
      eventId: "robo-climb",
      email: "asha@example.com",
    });
  });

  it("trims surrounding whitespace from a scan", () => {
    expect(parseTicketPayload("  PRV-AB12CD34|robo-climb|a@b.com  ")?.ticketId)
      .toBe("PRV-AB12CD34");
  });

  it("rejects the wrong number of parts", () => {
    expect(parseTicketPayload("PRV-AB12CD34|robo-climb")).toBeNull();
    expect(parseTicketPayload("a|b|c|d")).toBeNull();
  });

  it("rejects empty parts", () => {
    expect(parseTicketPayload("|robo-climb|a@b.com")).toBeNull();
    expect(parseTicketPayload("PRV-1|robo-climb|")).toBeNull();
  });

  it("rejects a non-Pravrutti QR", () => {
    expect(parseTicketPayload("https://example.com")).toBeNull();
    expect(parseTicketPayload("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run test/checkin-payload.test.ts`
Expected: FAIL — cannot resolve `@/lib/checkin`.

- [ ] **Step 3: Implement**

Create `lib/checkin.ts`:

```ts
export type TicketPayload = {
  ticketId: string;
  eventId: string;
  email: string;
};

/**
 * Parses the string encoded into a ticket QR by app/api/status/route.ts:
 *   `${ticketId}|${eventId}|${email}`
 *
 * Returns null for anything else, so a stray QR from another app is a clean
 * rejection rather than a lookup against garbage.
 */
export function parseTicketPayload(raw: string): TicketPayload | null {
  const parts = String(raw ?? "").trim().split("|");
  if (parts.length !== 3) return null;

  const [ticketId, eventId, email] = parts.map((p) => p.trim());
  if (!ticketId || !eventId || !email) return null;

  return { ticketId, eventId, email: email.toLowerCase() };
}
```

- [ ] **Step 4: Run them**

Run: `npx vitest run test/checkin-payload.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/checkin.ts test/checkin-payload.test.ts
git commit -m "feat(checkin): parse ticket QR payload"
```

---

### Task 6: Check-in endpoint

**Files:**
- Create: `app/api/checkin/route.ts`
- Test: `test/checkin-route.test.ts`

**Interfaces:**
- Consumes: `resolveRole()` (Task 3), `parseTicketPayload()` (Task 5), `Application.checkedInAt/By` (Task 4), `readJsonByPath`/`putJson`/`applicationPath` from `lib/blob-store`
- Produces: `POST /api/checkin` accepting `{ payload: string }`

Response shapes:
- Admitted: `200 { ok: true, alreadyCheckedIn: false, name, eventName, at }`
- Repeat: `200 { ok: true, alreadyCheckedIn: true, name, eventName, at, by }`
- Errors: `{ error: string }` with the status from the spec table

- [ ] **Step 1: Write the failing tests**

Create `test/checkin-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, any>();

vi.mock("@/lib/blob-store", () => ({
  applicationPath: (evId: string, email: string) => `app/${evId}/${email}.json`,
  readJsonByPath: async (p: string) => store.get(p) ?? null,
  putJson: async (p: string, data: unknown) => { store.set(p, data); },
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => role.current }));
vi.mock("@/lib/identity", () => ({ resolveEmail: async () => "boss@pravrutti.test" }));

const { POST } = await import("@/app/api/checkin/route");

const post = (payload: string) =>
  POST(new Request("http://t/api/checkin", {
    method: "POST",
    body: JSON.stringify({ payload }),
  }));

beforeEach(() => {
  store.clear();
  role.current = { kind: "organiser" };
  store.set("app/robo-climb/asha@example.com.json", {
    ticketId: "PRV-AAAA1111",
    eventId: "robo-climb",
    eventName: "Robo Climb",
    status: "confirmed",
    name: "Asha",
    email: "asha@example.com",
  });
});

describe("POST /api/checkin", () => {
  it("admits a confirmed ticket", async () => {
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyCheckedIn).toBe(false);
    expect(body.name).toBe("Asha");
  });

  it("is idempotent and keeps the original timestamp", async () => {
    const first = await (await post("PRV-AAAA1111|robo-climb|asha@example.com")).json();
    const second = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    const body = await second.json();
    expect(body.alreadyCheckedIn).toBe(true);
    expect(body.at).toBe(first.at);
    expect(body.by).toBe("boss@pravrutti.test");
  });

  it("rejects a coordinator", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(403);
  });

  it("rejects a pending application and names the status", async () => {
    store.get("app/robo-climb/asha@example.com.json").status = "pending";
    const res = await post("PRV-AAAA1111|robo-climb|asha@example.com");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/pending/i);
  });

  it("rejects a ticketId that does not match the stored record", async () => {
    const res = await post("PRV-WRONG999|robo-climb|asha@example.com");
    expect(res.status).toBe(404);
  });

  it("rejects a malformed QR", async () => {
    const res = await post("https://example.com");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run test/checkin-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/checkin/route`.

- [ ] **Step 3: Implement**

Create `app/api/checkin/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { resolveEmail } from "@/lib/identity";
import { parseTicketPayload } from "@/lib/checkin";
import { applicationPath, readJsonByPath, putJson } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  // Scanning admits someone to a paid event, so it is organiser-only.
  const role = await resolveRole();
  if (role.kind !== "organiser") return fail("Only organisers can check people in.", 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("That request wasn't readable.", 400);
  }

  const parsed = parseTicketPayload(body?.payload ?? "");
  if (!parsed) return fail("That QR isn't a Pravrutti ticket.", 400);

  const path = applicationPath(parsed.eventId, parsed.email);
  const record = (await readJsonByPath(path)) as Application | null;

  // Checking the ticketId too means a QR rebuilt for another person's email
  // cannot admit them on someone else's record.
  if (!record || record.ticketId !== parsed.ticketId)
    return fail("No ticket found for this event.", 404);

  if (record.status !== "confirmed")
    return fail(`This application is ${record.status}, not confirmed.`, 409);

  if (record.checkedInAt) {
    return NextResponse.json({
      ok: true,
      alreadyCheckedIn: true,
      name: record.name,
      eventName: record.eventName,
      at: record.checkedInAt,
      by: record.checkedInBy ?? null,
    });
  }

  const at = new Date().toISOString();
  const by = (await resolveEmail()) ?? "unknown";
  await putJson(path, { ...record, checkedInAt: at, checkedInBy: by }, true);

  return NextResponse.json({
    ok: true,
    alreadyCheckedIn: false,
    name: record.name,
    eventName: record.eventName,
    at,
  });
}
```

- [ ] **Step 4: Run them**

Run: `npx vitest run test/checkin-route.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkin/route.ts test/checkin-route.test.ts
git commit -m "feat(checkin): idempotent organiser-only check-in endpoint"
```

---

### Task 7: Coordinator roster endpoint

**Files:**
- Create: `app/api/dashboard/event/[eventId]/route.ts`
- Test: `test/dashboard-route.test.ts`

**Interfaces:**
- Consumes: `resolveRole()`, `canViewEvent()` (Task 3); `listAll`, `readPrivate` from `lib/blob-store`
- Produces: `GET /api/dashboard/event/[eventId]` returning
  `{ eventId, counts: { registered, confirmed, checkedIn, notArrived }, roster: Array<{ name, college, status, checkedInAt }> }`

- [ ] **Step 1: Write the failing tests**

Create `test/dashboard-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const apps: any[] = [];

vi.mock("@/lib/blob-store", () => ({
  listAll: async () => apps.map((_, i) => ({ pathname: `p${i}`, url: `u${i}` })),
  readPrivate: async (url: string) => apps[Number(url.slice(1))],
}));

const role = vi.hoisted(() => ({ current: { kind: "organiser" } as any }));
vi.mock("@/lib/roles", async () => {
  const actual = await vi.importActual<any>("@/lib/roles");
  return { ...actual, resolveRole: async () => role.current };
});

const { GET } = await import("@/app/api/dashboard/event/[eventId]/route");

const get = (eventId: string) =>
  GET(new Request("http://t"), { params: Promise.resolve({ eventId }) });

beforeEach(() => {
  role.current = { kind: "organiser" };
  apps.length = 0;
  apps.push(
    { eventId: "robo-climb", name: "Asha", college: "RUAS", email: "a@x.com",
      phone: "9000000001", status: "confirmed", checkedInAt: "2026-10-15T04:42:00.000Z" },
    { eventId: "robo-climb", name: "Bala", college: "RUAS", email: "b@x.com",
      phone: "9000000002", status: "confirmed" },
    { eventId: "robo-climb", name: "Chetan", college: "BMS", email: "c@x.com",
      phone: "9000000003", status: "pending" },
    { eventId: "skycraft", name: "Deepa", college: "RUAS", email: "d@x.com",
      phone: "9000000004", status: "confirmed" },
  );
});

describe("GET /api/dashboard/event/[eventId]", () => {
  it("NEVER returns contact details", async () => {
    const body = await (await get("robo-climb")).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("@x.com");
    expect(serialised).not.toContain("9000000001");
    for (const p of body.roster) {
      expect(p).not.toHaveProperty("email");
      expect(p).not.toHaveProperty("phone");
    }
  });

  it("counts registered, confirmed, checked in and not arrived", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.counts).toEqual({
      registered: 3, confirmed: 2, checkedIn: 1, notArrived: 1,
    });
  });

  it("returns only this event's applicants", async () => {
    const body = await (await get("robo-climb")).json();
    expect(body.roster.map((r: any) => r.name).sort()).toEqual(["Asha", "Bala", "Chetan"]);
  });

  it("lets a coordinator read their own event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("robo-climb")).status).toBe(200);
  });

  it("denies a coordinator another event", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await get("skycraft")).status).toBe(403);
  });

  it("denies a roleless account", async () => {
    role.current = { kind: "none" };
    expect((await get("robo-climb")).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run test/dashboard-route.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Implement**

Create `app/api/dashboard/event/[eventId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveRole, canViewEvent } from "@/lib/roles";
import { listAll, readPrivate } from "@/lib/blob-store";
import type { Application } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The only shape a coordinator ever receives. No contact fields exist here,
    so widening the query alone cannot leak an email or phone. */
type RosterEntry = {
  name: string;
  college: string;
  status: Application["status"];
  checkedInAt: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const role = await resolveRole();
  // One generic message for both "no access" and "no such event" — a
  // different reply would confirm which events exist.
  if (!canViewEvent(role, eventId))
    return NextResponse.json({ error: "No access to this event." }, { status: 403 });

  // Scoped to this event's prefix, not every application in the fest.
  const blobs = await listAll(`app/${eventId}/`);
  const records = (await Promise.all(blobs.map((b) => readPrivate(b.url))))
    .filter(Boolean) as Application[];

  const mine = records.filter((r) => r.eventId === eventId);

  const roster: RosterEntry[] = mine
    .map((r) => ({
      name: r.name,
      college: r.college,
      status: r.status,
      checkedInAt: r.checkedInAt ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const confirmed = mine.filter((r) => r.status === "confirmed");
  const checkedIn = confirmed.filter((r) => r.checkedInAt);

  return NextResponse.json(
    {
      eventId,
      counts: {
        registered: mine.length,
        confirmed: confirmed.length,
        checkedIn: checkedIn.length,
        notArrived: confirmed.length - checkedIn.length,
      },
      roster,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
```

- [ ] **Step 4: Run them**

Run: `npx vitest run test/dashboard-route.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/api/dashboard/event/[eventId]/route.ts" test/dashboard-route.test.ts
git commit -m "feat(dashboard): coordinator roster endpoint with no contact details"
```

---

### Task 8: Coordinator dashboard page

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/api/dashboard/me/route.ts`
- Test: manual, in the browser

**Interfaces:**
- Consumes: `resolveRole()` (Task 3); `GET /api/dashboard/event/[eventId]` (Task 7)
- Produces: `GET /api/dashboard/me` → `{ role, events: Array<{ eventId, name }> }`

- [ ] **Step 1: Create the "what can I see" endpoint**

Create `app/api/dashboard/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles";
import { events, eventId } from "@/lib/pravrutti-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await resolveRole();

  const visible =
    role.kind === "organiser"
      ? events
      : role.kind === "coordinator"
      ? events.filter((e) => role.eventIds.includes(eventId(e.name)))
      : [];

  return NextResponse.json(
    {
      role: role.kind,
      events: visible.map((e) => ({ eventId: eventId(e.name), name: e.name })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
```

- [ ] **Step 2: Build the page**

Create `app/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { useIdentity } from "@/lib/identity-context";

type Ev = { eventId: string; name: string };
type Counts = { registered: number; confirmed: number; checkedIn: number; notArrived: number };
type Entry = { name: string; college: string; status: string; checkedInAt: string | null };

export default function DashboardPage() {
  const me = useIdentity();
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const [role, setRole] = useState<string>("none");
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<{ counts: Counts; roster: Entry[] } | null>(null);

  useEffect(() => {
    if (!me.signedIn) return;
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role);
        setEvs(d.events);
        if (d.events.length > 0) setActive(d.events[0].eventId);
      })
      .catch(() => setEvs([]));
  }, [me.signedIn]);

  useEffect(() => {
    if (!active) return;
    setData(null);
    fetch(`/api/dashboard/event/${active}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [active]);

  return (
    <main className="relative min-h-screen bg-transparent text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />
      <div className="relative z-10 flex-1 w-full max-w-[900px] mx-auto px-6 py-28 font-ui">
        <h1 className="font-orbitron text-3xl font-black mb-6">Event dashboard</h1>

        {!me.ready ? null : !me.signedIn ? (
          <p className="text-white/60">Sign in to view your event.</p>
        ) : evs === null ? (
          <p className="text-white/60">Loading…</p>
        ) : evs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
            <p className="font-semibold mb-1.5">No dashboard access</p>
            <p className="text-sm text-white/50">
              This account isn&apos;t listed as a coordinator for any event. Contact
              the organising team if that looks wrong.
            </p>
          </div>
        ) : (
          <>
            {evs.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {evs.map((e) => (
                  <button
                    key={e.eventId}
                    onClick={() => setActive(e.eventId)}
                    className={`rounded-full px-4 py-2 text-sm font-medium border ${
                      active === e.eventId
                        ? "bg-[#D64D8D] text-white border-[#D64D8D]"
                        : "bg-white/[0.04] text-white/70 border-white/[0.1]"
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            )}

            {data && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {([
                    ["Registered", data.counts.registered],
                    ["Confirmed", data.counts.confirmed],
                    ["Checked in", data.counts.checkedIn],
                    ["Not arrived", data.counts.notArrived],
                  ] as const).map(([label, n]) => (
                    <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <p className="text-sm text-white/50">{label}</p>
                      <p className="font-orbitron text-2xl font-black">{n}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] overflow-hidden">
                  {data.roster.length === 0 ? (
                    <p className="p-6 text-sm text-white/50">No registrations yet.</p>
                  ) : (
                    data.roster.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.06] last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-sm text-white/45 truncate">{p.college}</p>
                        </div>
                        <span className="text-sm shrink-0">
                          {p.checkedInAt ? (
                            <span className="text-[#7BE3A8]">Checked in</span>
                          ) : p.status === "confirmed" ? (
                            <span className="text-white/45">Not arrived</span>
                          ) : (
                            <span className="text-[#F2D2AE]">{p.status}</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {role === "coordinator" && (
                  <p className="text-xs text-white/35 mt-4">
                    Contact details are held by the organising team.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      <FooterSection />
    </main>
  );
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v developers-section | head`
Expected: no errors from `app/dashboard` or `app/api/dashboard`.

- [ ] **Step 4: Check it in the browser**

Add your own email to `ORGANISER_EMAILS` in `.env.local`, restart the dev server, sign in, and open `/dashboard`. Confirm: counts render, the roster lists names and colleges, and **no email or phone appears anywhere**. Open devtools → Network → the `event/<id>` response and confirm the JSON contains no `email` or `phone` key.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard app/api/dashboard/me
git commit -m "feat(dashboard): coordinator page listing only their own events"
```

---

### Task 9: Scanner page

`qrcode` only generates. Decoding needs a separate library.

**Files:**
- Modify: `package.json`
- Create: `app/admin/scan/page.tsx`
- Test: manual, on a phone

**Interfaces:**
- Consumes: `POST /api/checkin` (Task 6); `GET /api/dashboard/me` (Task 8) for the organiser check
- Produces: nothing later tasks depend on

- [ ] **Step 1: Install the decoder**

```bash
cd /home/voxmastery/Desktop/fest-web
npm install @zxing/browser@^0.1.5 @zxing/library@^0.21.3
```

- [ ] **Step 2: Build the scanner**

Create `app/admin/scan/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useIdentity } from "@/lib/identity-context";

type Result =
  | { tone: "ok"; title: string; detail: string }
  | { tone: "warn"; title: string; detail: string }
  | { tone: "err"; title: string; detail: string };

export default function ScanPage() {
  const me = useIdentity();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!me.signedIn) return;
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then((d) => setAllowed(d.role === "organiser"))
      .catch(() => setAllowed(false));
  }, [me.signedIn]);

  useEffect(() => {
    if (allowed !== true || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let stop: (() => void) | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (res) => {
        if (!res || busy.current) return;
        busy.current = true;
        try {
          const r = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: res.getText() }),
          });
          const body = await r.json();
          if (!r.ok) {
            setResult({ tone: "err", title: "Not admitted", detail: body.error });
          } else if (body.alreadyCheckedIn) {
            setResult({
              tone: "warn",
              title: `${body.name} — already checked in`,
              detail: `At ${new Date(body.at).toLocaleTimeString()}${body.by ? ` by ${body.by}` : ""}`,
            });
          } else {
            setResult({ tone: "ok", title: `${body.name} admitted`, detail: body.eventName });
            setCount((c) => c + 1);
          }
        } catch {
          setResult({ tone: "err", title: "Network problem", detail: "Try that scan again." });
        }
        // Pause between reads so one ticket cannot fire repeatedly while held
        // in frame, and the operator has time to read the banner.
        setTimeout(() => { busy.current = false; }, 2500);
      })
      .then((controls) => { stop = () => controls.stop(); })
      .catch(() => setResult({
        tone: "err",
        title: "Camera unavailable",
        detail: "Allow camera access, then reload.",
      }));

    return () => stop?.();
  }, [allowed]);

  if (me.ready && !me.signedIn)
    return <main className="min-h-screen grid place-items-center text-white font-ui">Sign in to scan.</main>;
  if (allowed === false)
    return <main className="min-h-screen grid place-items-center text-white font-ui">Organisers only.</main>;

  const tone =
    result?.tone === "ok" ? "bg-[#12B76A]" :
    result?.tone === "warn" ? "bg-[#BF8A1B]" :
    result?.tone === "err" ? "bg-[#AC355D]" : "bg-white/10";

  return (
    <main className="min-h-screen bg-[#0A0818] text-white font-ui flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <span className="font-orbitron font-black">CHECK-IN</span>
        <span className="text-sm text-white/60">{count} admitted</span>
      </div>

      <video ref={videoRef} className="w-full flex-1 object-cover bg-black" muted playsInline />

      <div className={`p-5 ${tone} transition-colors`}>
        {result ? (
          <>
            <p className="font-semibold text-lg leading-snug">{result.title}</p>
            <p className="text-sm opacity-90">{result.detail}</p>
          </>
        ) : (
          <p className="text-sm text-white/70">Point the camera at a ticket QR.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v developers-section | head`
Expected: no errors from `app/admin/scan`.

- [ ] **Step 4: Test on a phone**

Serve over HTTPS or localhost — browsers block camera access otherwise. With your email in `ORGANISER_EMAILS`, apply for an event, confirm it in `/admin`, open `/ticket` on a second device, and scan it. Confirm: green banner with the name, then scanning the same ticket again shows the amber "already checked in" banner with the original time.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/admin/scan
git commit -m "feat(scan): organiser QR check-in scanner"
```

---

### Task 10: Move /admin off the shared key

**Files:**
- Modify: `app/api/admin/route.ts:9-11`
- Modify: `app/admin/page.tsx`
- Modify: `.env.example`
- Test: `test/admin-auth.test.ts`

**Interfaces:**
- Consumes: `resolveRole()` (Task 3)
- Produces: `/api/admin` gated by role, not `x-admin-key`

- [ ] **Step 1: Write the failing test**

Create `test/admin-auth.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const role = vi.hoisted(() => ({ current: { kind: "none" } as any }));
vi.mock("@/lib/roles", () => ({ resolveRole: async () => role.current }));
vi.mock("@/lib/blob-store", () => ({
  listAll: async () => [], readPrivate: async () => null,
  readJsonByPath: async () => null, putJson: async () => {},
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
}));

const { GET } = await import("@/app/api/admin/route");

describe("/api/admin authorisation", () => {
  it("rejects a roleless account", async () => {
    role.current = { kind: "none" };
    expect((await GET(new Request("http://t/api/admin"))).status).toBe(403);
  });

  it("rejects a coordinator", async () => {
    role.current = { kind: "coordinator", eventIds: ["robo-climb"] };
    expect((await GET(new Request("http://t/api/admin"))).status).toBe(403);
  });

  it("allows an organiser", async () => {
    role.current = { kind: "organiser" };
    expect((await GET(new Request("http://t/api/admin"))).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/admin-auth.test.ts`
Expected: FAIL — the route still reads `x-admin-key`, so an organiser gets 401.

- [ ] **Step 3: Swap the gate**

In `app/api/admin/route.ts`, delete the `authed()` function and add at the top:

```ts
import { resolveRole } from "@/lib/roles";
```

Replace both guard lines — currently
`if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
in `GET` and `POST` — with:

```ts
  const role = await resolveRole();
  if (role.kind !== "organiser")
    return NextResponse.json({ error: "Organisers only." }, { status: 403 });
```

- [ ] **Step 4: Run it**

Run: `npx vitest run test/admin-auth.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Drop the key from the page**

In `app/admin/page.tsx`, remove the admin-key prompt and the `x-admin-key` header from every `fetch`. Signed-in organisers are authorised by session; anyone else gets the 403 body already returned by the API.

- [ ] **Step 6: Update `.env.example`**

Replace the `ADMIN_KEY` line with:

```
# Comma-separated Google emails with full organiser access.
ORGANISER_EMAILS=
```

- [ ] **Step 7: Full check**

Run: `npm test && npx tsc --noEmit 2>&1 | grep -v developers-section | head`
Expected: all tests pass, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/route.ts app/admin/page.tsx .env.example test/admin-auth.test.ts
git commit -m "feat(admin): replace shared ADMIN_KEY with organiser sign-in

A single shared password meant no action could be attributed to a person.
Every approve, decline and scan now has an owner."
```

---

### Task 11: Scope the counts query to one event

`GET /api/register` calls `listAll("app/")` and reads **every** application across **every** event on each request — roughly 2,500 blob reads at capacity. The dashboards poll it.

**Files:**
- Modify: `app/api/register/route.ts` (the `GET` handler, ~line 40-50)
- Test: `test/register-scope.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `GET /api/register?event=<id>` reads only `app/<id>/`

- [ ] **Step 1: Write the failing test**

Create `test/register-scope.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prefixes: string[] = [];
vi.mock("@/lib/blob-store", () => ({
  listAll: async (p: string) => { prefixes.push(p); return []; },
  readPrivate: async () => null,
  readJsonByPath: async () => null,
  putJson: async () => {},
  applicationPath: (e: string, m: string) => `app/${e}/${m}.json`,
  teamPath: (e: string, c: string) => `team/${e}/${c}.json`,
  teamMemberPath: (e: string, m: string) => `team-member/${e}/${m}.json`,
  listTeamMembers: async () => [],
}));

const { GET } = await import("@/app/api/register/route");

beforeEach(() => { prefixes.length = 0; });

describe("GET /api/register scoping", () => {
  it("reads only one event's prefix when a slug is given", async () => {
    await GET(new Request("http://t/api/register?event=robo-climb"));
    expect(prefixes).toEqual(["app/robo-climb/"]);
  });

  it("still reads everything when no slug is given", async () => {
    await GET(new Request("http://t/api/register"));
    expect(prefixes).toEqual(["app/"]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/register-scope.test.ts`
Expected: FAIL — the first test gets `["app/"]`.

- [ ] **Step 3: Scope the listing**

In the `GET` handler of `app/api/register/route.ts`, replace:

```ts
  const blobs = await listAll("app/");
```

with:

```ts
  // Scoped when a slug is given: reading every application across every event
  // is ~2,500 blob reads at capacity, and the dashboards poll this.
  const blobs = await listAll(slug ? `app/${slug}/` : "app/");
```

`slug` is already read from the query string at the top of the handler.

- [ ] **Step 4: Run it**

Run: `npx vitest run test/register-scope.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Confirm the panel still works**

Open an event on `/events`. The registration card must still show its seat count — that call passes `?event=<slug>`, so it now takes the scoped path.

- [ ] **Step 6: Commit**

```bash
git add app/api/register/route.ts test/register-scope.test.ts
git commit -m "perf(register): scope counts to one event's prefix"
```

---

### Task 12: Ship it

**Files:** none

- [ ] **Step 1: Full check**

```bash
cd /home/voxmastery/Desktop/fest-web
npm test
npx tsc --noEmit 2>&1 | grep -v developers-section | head
npx next build 2>&1 | tail -5
```

Expected: all tests pass, no new type errors, build succeeds.

- [ ] **Step 2: Set the production env var**

```bash
printf '%s' "your@email.com,second@organiser.com" | npx vercel env add ORGANISER_EMAILS production
```

Env changes only take effect on a new build, so deploy after this.

- [ ] **Step 3: Deploy**

```bash
npx vercel deploy --prod
```

- [ ] **Step 4: Verify on production**

```bash
B="https://fest-web-main.vercel.app"
for p in / /events /dashboard /admin; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$B$p")  $p"
done
curl -s -o /dev/null -w "checkin unauthenticated: %{http_code}\n" -X POST \
  -H 'Content-Type: application/json' -d '{"payload":"x|y|z"}' --max-time 20 "$B/api/checkin"
```

Expected: pages `200`; `/api/checkin` returns `403` for an unauthenticated caller — **if it returns 200, stop and fix it before going further.**

- [ ] **Step 5: Commit any final changes**

```bash
git add -A && git commit -m "chore: dashboards live"
```

---

## Deferred, deliberately

- **No manual check-in fallback.** Scan-only was chosen. A flat battery or denied camera permission leaves a participant unscannable. Revisit before the day.
- **Coordinator emails are `0/26`.** Test with your own addresses in `ORGANISER_EMAILS` and hand-added `coordinators` entries until the spreadsheet returns.
- **No feedback analytics.** Not being collected at this stage.
