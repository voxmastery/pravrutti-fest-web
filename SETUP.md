# Pravrutti — fest site

Next.js 16 · Vercel Blob · deployed at https://fest-web-main.vercel.app

## Run it

```bash
npm install
cp .env.example .env.local   # fill in BLOB_READ_WRITE_TOKEN and ADMIN_KEY
npm run dev
```

## How the application flow works

Apply → pay → queue → confirmed or refunded.

1. A student applies via the 3-step dialog on any event page.
2. The application is stored as one JSON blob per person, per event:
   `app/{eventId}/{sha256(eventId:email)}.json` — the hashed path is what
   prevents duplicate applications without needing a database.
3. Status starts at `pending`. No ticket or QR is issued yet.
4. Organisers open `/admin`, enter `ADMIN_KEY`, and confirm or decline.
   Declining a paid application marks it refunded and timestamps it.
5. Confirmed applicants see their QR at `/ticket`.

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
| `components/registration-dialog.tsx` | The 3-step apply flow |
| `app/admin/page.tsx` | Organiser console |

## Things to change before the fest

- **Capacity** — `EVENT_CAPACITY` in `lib/pravrutti-data.ts`. Defaults to 100 per event.
- **Payments** — set `PAYMENTS_LIVE = true` in `lib/applications.ts` once a
  gateway is wired. Until then paid events mark the fee "awaiting" and
  organisers settle at the desk.
- **Sign-in** — add one auth backend's env vars (see `.env.example`).
  Until then anyone who knows an applicant's email can view their status
  at `/ticket`.
- **Confirmation emails** — not built. Needs a Resend or SES key.

## Careful

- Reads after writes on Vercel Blob can come back stale from the edge.
  Every read here appends a `?ts=` cache-buster and every write sets
  `cacheControlMaxAge: 0`. Keep that up in any new code touching the store.
- Don't run `clerk init` — it scaffolds Clerk's own UI components and
  provider over the headless setup already in place.
