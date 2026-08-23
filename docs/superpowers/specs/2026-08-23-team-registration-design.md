# Team registration with join codes, and mandatory sign-in

**Date:** 2026-08-23
**Status:** Approved for planning

## Problem

Events allow squads of up to four, but the system has no concept of a team. An
application carries `teamName` and `members` as free text — a comma-separated
string nobody validates. Nothing links teammates together, nothing verifies a
named teammate agreed to take part, and nothing stops the same person being
listed on five different teams.

Separately, anyone can register under any typed email. Sign-in exists but is
optional, and no auth backend is configured, so `resolveEmail()` always returns
`null`.

## Goals

- A signed-in user creates a team for an event and becomes its leader.
- The leader receives a short code. Others enter that code to join the team.
- Every member holds their own application and their own ticket.
- Registration requires a Google-verified email.

## Non-goals (v1)

- Leaving or disbanding a team, or transferring leadership. A wrong team means
  contacting organisers.
- Teams that span multiple events. A team belongs to exactly one event.
- Inviting by email. The code is the only join mechanism.

## Decisions

| Decision | Choice |
|---|---|
| Auth backend | Google via NextAuth (`lib/auth.ts`, already wired) |
| Application granularity | One application and one ticket per member |
| Capacity accounting | Counts people — a 4-person team uses 4 of 100 seats |
| Team scope | One event |
| Fee | Per-event flag `feePerTeam` |
| Auth not configured | Fail closed — registration disabled with a clear notice |

## Architecture

### Why the roster is derived, not stored

Storage is Vercel Blob: no transactions, no unique indexes, and overwritten
blobs can serve stale from the edge — `readPrivate()` already cache-busts every
read for exactly this reason.

If a team blob held a `members[]` array, each join would read-modify-write it.
Two people joining at once both read the same array, both append, and the second
write silently erases the first. There is no compare-and-swap to prevent it.

So membership lives on each member's own application, which only that member
writes. The team blob holds only facts fixed at creation. The roster is an
emergent property: everyone in the event whose application carries the code.
Concurrent joins cannot conflict because they touch different blobs.

### Storage layout

```
teamcode/{CODE}.json
  { code, teamId, eventId, teamName, leaderEmail, maxSize, createdAt }

app/{eventId}/{sha256(eventId:email)[0:24]}.json
  Application + { teamId, teamCode, teamRole: "leader" | "member" }
```

Code resolution is a single blob read. Roster size and duplicate checks list
only the `app/{eventId}/` prefix, bounded by one event's applicants.

> **Pre-existing performance note.** `GET /api/register` currently calls
> `listAll("app/")` and then reads *every* application across *all* events on
> every request, just to produce per-event counts. At 25 events × 100 seats
> that is up to 2,500 blob reads per page load. This design does not worsen it
> (team reads are scoped to one event's prefix), but it should be narrowed to
> `app/{eventId}/` when a slug is supplied. Flagged, not silently inherited.

### Code format

Six characters from a 32-symbol alphabet that omits visually ambiguous glyphs:

```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789     (no I, O, 0, 1)
```

32⁶ ≈ 1.07 billion combinations. Generation checks for an existing blob and
retries up to five times before returning an error. Input is uppercased and
stripped of spaces and dashes before lookup, so `prv 7k2m` and `PRV-7K2M` are
the same code to the user.

## Data model changes

### `Event` (`lib/pravrutti-data.ts`)

```ts
maxTeamSize?: number;   // default 4, includes the leader; 1 disables teams
feePerTeam?: boolean;   // true = leader pays once; false/undefined = each pays
```

`maxTeamSize: 1` hides team options entirely for that event.

### `Application` (`lib/applications.ts`)

```ts
teamId: string | null;
teamCode: string | null;
teamRole: "leader" | "member" | null;
```

The existing `teamName` is retained and populated from the team record.
`members` becomes vestigial for team applications; it stays for solo applicants
who type teammates manually, and is not read for teams.

### New `lib/teams.ts`

Owns the team vocabulary so neither the API route nor the UI grows team logic:
`Team` type, `CODE_ALPHABET`, `generateCode()`, `normalizeCode()`,
`isValidCodeShape()`, `maxTeamSizeFor(event)`, `feeForMember(event, role)`.

## API

### `POST /api/teams` — create

Requires a verified email. Body: `{ eventId, teamName }`.
Generates a unique code, writes `teamcode/{CODE}.json`, then writes the leader's
application via the shared application-writing path.
Returns `{ code, teamId, teamName, ticketId, queuePosition, capacity }`.

### `GET /api/teams?code=XXXXXX` — preview before joining

Resolves the code and returns `{ teamName, eventId, eventName, memberCount,
maxSize, full }` so the UI can show "Joining **Circuit Breakers** for
ElectroXcape — 2 of 4 members" before the user commits. Never returns member
emails; only a count.

### `POST /api/register` — extended

Accepts an optional `teamCode`. When present: resolve the code, verify its
`eventId` matches the submitted event, verify the roster has room, then write
the applicant's application carrying the team fields and the role-appropriate
fee. When absent, behaviour is unchanged (solo).

### Auth gate

A single helper, `requireVerifiedEmail()`, guards `POST /api/register` and
`POST /api/teams`:

- No auth backend configured → `503` with an organiser-facing message.
- Configured but not signed in → `401`.
- Signed in → returns the verified email, which overrides any submitted email.

`GET /api/config` gains `authReady: boolean` so the UI can disable the register
button up front and read **"Sign-in setup pending"** rather than letting someone
fill three steps and fail at submit.

## User flow

Step 1 of the apply form becomes a fork, shown only when `maxTeamSize > 1`:

```
  ○ Registering solo
  ○ Create a team        → team name → code shown, with copy button
  ○ Join a team          → code input → live preview → confirm
```

Signed-out users see Continue with Google in place of the fork. The rest of the
form (phone, college, review) is unchanged. On success a leader's result screen
shows the code prominently with copy-to-clipboard and share text; a member's
shows which team they joined.

## Admin

Applications gain a team badge and group by `teamId`. Confirming or declining
acts on the **whole team by default**, with a per-member override, because
confirming three of four members leaves a team that cannot compete.

> **Stated assumption.** Team-level approval was not explicitly requested. It
> follows from per-member applications plus team events, but if organisers want
> purely individual approval, this is the one behaviour to change.

## Error handling

| Condition | Status | User-facing message |
|---|---|---|
| Auth backend not configured | 503 | Sign-in isn't set up yet. Contact the organisers. |
| Not signed in | 401 | Sign in to register. |
| Unknown code | 404 | No team found with that code. Check it and try again. |
| Code belongs to another event | 409 | That code is for {eventName}. |
| Team already full | 409 | {teamName} already has all {n} members. |
| Already applied to this event | 409 | You've already applied for this event. |
| Registration closed | 409 | Applications closed on 4 October 2026. |
| Code generation exhausted retries | 500 | Couldn't create the team. Try again. |

Capacity and team size are independent: a team can have room while the event is
full. An applicant hitting a full event gets the existing waitlist behaviour
regardless of team state.

## Testing

**Unit** — code generation alphabet and length; `normalizeCode` on lowercase,
spaced, and dashed input; collision retry; `feeForMember` under both
`feePerTeam` settings; `maxTeamSizeFor` defaulting.

**Integration** — create returns a resolvable code; join attaches the correct
`teamId`; the (n+1)th join is rejected; a code from event A rejected on event B;
duplicate application rejected; every endpoint rejects unverified callers;
endpoints return 503 with no auth configured.

**Concurrency** — the case that motivated the architecture: fire the final two
joins for a 4-person team simultaneously and assert exactly one succeeds and the
roster never exceeds `maxTeamSize`.

**E2E** — leader creates and copies a code; a second signed-in user joins with
it; both appear on the same team in `/admin`; both tickets resolve.

## Files

**New** — `lib/teams.ts`, `app/api/teams/route.ts`, `components/team-step.tsx`,
tests.

**Modified** — `lib/pravrutti-data.ts` (two `Event` fields),
`lib/applications.ts` (three `Application` fields), `lib/identity.ts`
(`requireVerifiedEmail`), `app/api/register/route.ts` (team branch + gate),
`app/api/config/route.ts` (`authReady`), `components/registration-dialog.tsx`
(the fork), `app/admin/page.tsx` (grouping), `.env.example` (Google vars).

## Prerequisites

Registration stays disabled until these exist in `.env.local`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

`BLOB_READ_WRITE_TOKEN` is also still unset; without it no application of any
kind persists.
