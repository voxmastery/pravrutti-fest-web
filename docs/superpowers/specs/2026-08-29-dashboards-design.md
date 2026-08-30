# Coordinator and organiser dashboards

**Date:** 2026-08-29
**Status:** Awaiting review

## Problem

Twenty-six events, ten live applications and growing, and no way for anyone to
see their own event's numbers. `/admin` exists but is gated behind a single
shared `ADMIN_KEY` string with no record of who used it, and it shows every
event to whoever holds the password.

Separately, **check-in does not exist**. The ticket QR encodes
`ticketId|eventId|email` and is rendered on `/ticket`, but nothing reads it.
There is no `checkedIn` field on `Application` and no scan endpoint. "See who
checked in and who didn't" is therefore not a view over existing data — the
mechanism has to be built first.

## Goals

- Each event's two coordinators can watch their own event: who registered, who
  turned up, who did not.
- Organisers can run check-in by scanning tickets, and retain full control.
- Replace the shared admin password with per-person Google sign-in.

## Non-goals

- Coordinators changing anything. They observe only.
- Coordinators seeing participant contact details. Not shown at all.
- Feedback analytics. Not being collected at this stage.
- Volunteer accounts. Check-in is organiser-run.

## Decisions

| Decision | Choice |
|---|---|
| Check-in method | QR scan on a phone |
| Coordinator visibility | name, college, status, check-in time — **no contact details** |
| Coordinator powers | observe only |
| Role source | Google email, resolved server-side |

---

## 1. Roles

Three roles, resolved from the signed-in Google email:

| Role | Scope | Powers |
|---|---|---|
| Participant | own applications | existing `/ticket` |
| Coordinator | one event | view roster, view check-in status |
| Organiser | all events | approve, decline, mark paid, scan check-ins |

New `lib/roles.ts`:

```ts
type Role = { kind: "organiser" }
          | { kind: "coordinator"; eventIds: string[] }
          | { kind: "none" };

async function resolveRole(): Promise<Role>
```

Coordinator emails are stored per event as `coordinators: string[]` on `Event`,
populated from the collection spreadsheet. Organiser emails come from an env
var (`ORGANISER_EMAILS`, comma-separated) so adding one does not require
redeploying the data file.

### The security property that matters

Role is resolved **server-side on every request** from the session, via the
existing `resolveEmail()`. It is never accepted from the client — not as a
query param, a header, or a body field.

Every dashboard endpoint re-derives the role and re-checks scope. A coordinator
calling another event's endpoint gets `403` regardless of what their UI
offered. Hiding a button is presentation; the check is what enforces it.

This also retires `ADMIN_KEY`: today it is one password shared among organisers,
so an action cannot be attributed to a person. Google sign-in gives every
action an owner.

---

## 2. Check-in

### Data

Two fields added to `Application`:

```ts
checkedInAt?: string;   // ISO timestamp
checkedInBy?: string;   // organiser email
```

Both optional, so the ten existing applications remain valid with no migration.

### `POST /api/checkin`

Body: `{ payload: string }` — the raw scanned string.

Server steps, in order:

1. Resolve role. Reject unless organiser → `403`.
2. Parse `ticketId|eventId|email`. Malformed → `400`.
3. Load that application. Missing, or ticketId mismatch → `404`.
4. Status not `confirmed` → `409` naming the actual status. A pending or
   declined person must not be admitted by a scan.
5. Already checked in → `200` with `{ alreadyCheckedIn: true, at, by }`.
6. Otherwise stamp `checkedInAt` and `checkedInBy`, return the participant's
   name and event.

**Idempotent on purpose.** A second scan never double-counts. It returns *when*
and *by whom*, rather than a bare success — at a desk with a queue, a silent
success on a re-scan hides a duplicate and the operator learns nothing.

### Scanner

`/admin/scan`, organiser-only, phone-oriented: camera view, large result banner
(green admitted / amber already checked in / red rejected with the reason), and
a running count for the session.

**Known failure mode.** Scanning is the only path by decision. A flat battery,
a cracked screen, or a denied camera permission leaves that participant
unscannable with no manual fallback. Flagged deliberately rather than solved by
adding a fallback that was not asked for — worth revisiting before the day.

---

## 3. Coordinator dashboard

Route `/dashboard`. Lists only events where the signed-in email appears in that
event's `coordinators`. Zero events → an explanatory empty state, not a 403.

Per event:

- **Counts:** registered, confirmed, checked in, not yet arrived
- **Roster:** name, college, status, check-in time

### `GET /api/dashboard/event/[eventId]`

Rejects `403` unless the caller is an organiser, or a coordinator **of that
specific event**.

The response is built by projecting each application to exactly:

```ts
{ name, college, status, checkedInAt }
```

Contact details are not included in the response at any point. This is a
projection at the source, not a field the UI declines to render — there is no
endpoint a coordinator can call that returns a participant's email or phone.

Coordinators who need to contact a participant go through organisers, who hold
the details. Worth agreeing who handles that on the day, since it is a real
workflow that now lives with organisers rather than on the coordinator's screen.

---

## 4. Organiser dashboard

Extends `/admin`, moved from `ADMIN_KEY` to Google sign-in:

- All 26 events with live counts
- Existing `confirm` / `decline` / `mark_paid`
- Link to the scanner
- Full participant details, including contacts

---

## 5. Error handling

| Condition | Status | Behaviour |
|---|---|---|
| Not signed in | 401 | prompt sign-in |
| Signed in, no role | 403 | "This account has no dashboard access" |
| Coordinator, wrong event | 403 | generic — does not confirm the event exists |
| Scan: not confirmed | 409 | names the actual status |
| Scan: already checked in | 200 | reports time and operator |
| Scan: malformed | 400 | "That QR isn't a Pravrutti ticket" |

---

## 6. Testing

**Unit** — `resolveRole` for organiser, coordinator, multi-event coordinator,
unknown email; QR payload parsing including malformed input.

**Integration** — coordinator cannot read another event (`403`); roster
response contains **no** `email` or `phone` key for any participant; scanning a
pending application is rejected; scanning twice returns `alreadyCheckedIn`
without changing the original timestamp; non-organiser cannot scan.

**The projection test is the important one.** Assert on the absence of contact
keys in the serialised response, not on what the UI displays. A future change
that widens the query would otherwise pass silently.

**E2E** — coordinator signs in, sees only their event; organiser scans a
confirmed ticket and the coordinator's view reflects it.

---

## 7. Files

**New:** `lib/roles.ts`, `app/api/checkin/route.ts`,
`app/api/dashboard/event/[eventId]/route.ts`, `app/dashboard/page.tsx`,
`app/admin/scan/page.tsx`, tests.

**Modified:** `lib/applications.ts` (two fields), `lib/pravrutti-data.ts`
(`coordinators: string[]` per event), `app/admin/page.tsx` and
`app/api/admin/route.ts` (key → Google auth), `.env.example`
(`ORGANISER_EMAILS`).

---

## 8. Prerequisites and known issues

**Blocked on data.** Coordinator emails are `0/26`. Nothing here can be tested
with real accounts until the collection spreadsheet returns. Organiser emails
can be set immediately.

**Consent screen.** If the Google consent screen is still in Testing, only
listed test users can sign in — which would block coordinators entirely.

**Pre-existing performance problem.** `GET /api/register` calls `listAll("app/")`
and reads *every* application across *every* event on each request — roughly
2,500 blob reads at capacity. A dashboard polling it would be slow and
expensive. Scope it to `app/{eventId}/` as part of this work rather than
inheriting it.
