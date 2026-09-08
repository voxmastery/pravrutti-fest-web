# Pravrutti — fest site

Next.js 16 · Vercel Blob · deployed at https://fest-web-main.vercel.app

## Run it

```bash
npm install
cp .env.example .env.local   # fill in BLOB_READ_WRITE_TOKEN, ADMIN_KEY, ORGANISER_EMAILS
npm run dev
```

## How the application flow works

Apply → pay → queue → confirmed or refunded.

1. A student applies via the 3-step dialog on any event page.
2. The application is stored as one JSON blob per person, per event:
   `app/{eventId}/{sha256(eventId:email)}.json` — the hashed path is what
   prevents duplicate applications without needing a database.
3. Status starts at `pending`. No ticket or QR is issued yet.
4. Organisers open `/dashboard/applications` — the registrations desk — click a
   name to see everything that person submitted, record the payment ID, and hit
   **Verify payment & approve**. That marks the fee paid, confirms the
   application, and emails their ticket QR in one action.
   `/admin` with `ADMIN_KEY` remains as a fallback console.
5. Confirmed applicants see their QR at `/ticket`, and get the same QR attached
   to their confirmation email.

## Key files

| Path | What it does |
|---|---|
| `lib/pravrutti-data.ts` | All 27 events, fest dates, capacities |
| `lib/applications.ts` | Application type, statuses, `PAYMENTS_LIVE` flag |
| `lib/identity-context.tsx` | `useIdentity()` — the one auth hook the UI uses |
| `lib/identity.ts` | Server-side `resolveEmail()` for API routes |
| `app/api/register/route.ts` | Apply + public counts |
| `app/api/status/route.ts` | An applicant's own applications |
| `app/api/admin/route.ts` | Review queue, confirm/decline/mark-paid |
| `app/api/dashboard/applications/route.ts` | Registrations: full list, verify, email, QR |
| `lib/coordinator-phones.ts` | Coordinators' mobiles — server-only, never bundled |
| `app/api/events/coordinators/route.ts` | Hands those numbers to approved participants only |
| `lib/payment-review.ts` | The only place payment/decision fields are written |
| `lib/confirmation-email.ts` | "You're confirmed" email with the QR attached |
| `lib/ticket-qr.ts` | The single definition of a ticket QR's contents |
| `components/registration-dialog.tsx` | The 3-step apply flow |
| `app/dashboard/applications/page.tsx` | Registrations desk (organisers) |
| `app/admin/page.tsx` | Fallback organiser console |

## Things to change before the fest

- **Capacity** — `EVENT_CAPACITY` in `lib/pravrutti-data.ts`. Defaults to 100 per event.
- **Payments** — set `PAYMENTS_LIVE = true` in `lib/applications.ts` once a
  gateway is wired. Until then paid events mark the fee "awaiting" and
  organisers settle at the desk.
- **Sign-in** — add one auth backend's env vars (see `.env.example`).
  Until then anyone who knows an applicant's email can view their status
  at `/ticket`.
- **Organiser dashboard** — put staff Google addresses in `ORGANISER_EMAILS`
  (comma-separated, lowercase) in `.env.local` and in Vercel → Settings →
  Environment Variables (Production). An address that is only listed in an
  event's `dashboardEmails` in `lib/pravrutti-data.ts` sees that event's
  coordinator view, not the all-events organiser table. Env changes on
  Vercel take effect on the next deploy.
- **Confirmation emails** — built, but dormant until `RESEND_API_KEY` and
  `MAIL_FROM` are set. Until then the registrations desk says so plainly and
  verifying a payment approves the applicant without emailing them.

## Careful

- **Never put a phone number or a room number in `lib/pravrutti-data.ts`.**
  Client components import the events array, so anything in that file ships to
  every browser in the JS bundle whether or not it is rendered. Two kinds of
  private detail live in `server-only` modules instead:
  - `lib/coordinator-phones.ts` — coordinator mobiles, matched to the public
    coordinator list by name, so renaming someone in one file means renaming
    them in the other or their call button quietly disappears.
  - `lib/event-venues.ts` — the exact hall, keyed by event id.

  Both are served by `GET /api/events/coordinators?event=<slug>`, which hands
  them only to a participant whose application is `confirmed` or to that
  event's own staff. The public surface shows the campus and the coordinator's
  name, with no placeholder hinting that anything is withheld. `lib/
  event-access.ts` holds the single entitlement check; add new per-viewer event
  data there rather than writing a second one.
- Reads after writes on Vercel Blob can come back stale from the edge.
  Every read here appends a `?ts=` cache-buster and every write sets
  `cacheControlMaxAge: 0`. Keep that up in any new code touching the store.
- Don't run `clerk init` — it scaffolds Clerk's own UI components and
  provider over the headless setup already in place.
