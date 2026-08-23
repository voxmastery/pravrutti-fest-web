# UX audit — measured against Laws of UX

All figures read from the live DOM at 1280px, not estimated. Contrast is
computed with proper alpha compositing over the resolved card background
(`rgb(29,20,33)`), because the site uses translucent `white/N` text — a naive
reading of `getComputedStyle().color` returns `oklab()` and produces nonsense.

## Violations found and fixed

### Law of Proximity — events list

Gap between cards was **16px**. Padding inside each card was **16px**. The
distance separating two different events was identical to the distance between
a card's edge and its own content, so nothing signalled where one group ended.

Fixed: gap **24px**, padding **20px**. External separation now exceeds internal,
which is the condition proximity grouping actually depends on.

### Aesthetic-Usability Effect / contrast — tier label

| Element | Before | After | AA floor |
|---|---|---|---|
| Event title | 17.88 | 17.88 | 4.5 |
| Sub-category chip | 7.02 | 7.02 | 4.5 |
| Host / venue | 5.27 | 5.27 | 4.5 |
| **Tier label** | **2.26** | **6.07** | 4.5 |

`white/25` failed WCAG AA badly. Raised to `white/55`.

### Fitts's Law — navigation

| Target | Before | After |
|---|---|---|
| Nav links | 24px | 40px |
| RESOURCES trigger | 16px | 40px |

The labels are 12px; the *targets* were barely larger. Vertical padding lifts
the hit area without changing the visual. Both now clear WCAG 2.2 SC 2.5.8
(24px minimum). Inline links in prose remain 18px, which that criterion
explicitly exempts.

### Card proportion

605x179 (3.38:1) with a 110px poster at 18% width / 61% height — a letterbox
with a small square floating in a gap. Now 528x187 (2.83:1), poster at 27%
width and 78% height, stretched to card height rather than fixed.

## Laws the site already satisfies

- **Law of Similarity / Uniform Connectedness** — every event card is
  structurally identical, so the set reads as one system.
- **Common Region** — cards carry both a border and a fill, giving an
  unambiguous boundary.
- **Hick's Law** — 6 nav items, 4 category tabs, one CTA. 26 events are never
  shown at once; the tabs cut the visible set to 6-8.
- **Miller's Law** — that chunking keeps each view inside working-memory limits.
- **Jakob's Law** — deliberately adopting Luma's conventions means users arrive
  with a working mental model rather than learning ours.
- **Von Restorff** — SIGN IN is the only solid-filled button in the bar, so the
  one action that matters is the one that stands out.
- **Tesler's Law** — irreducible complexity sits in the system, not the user:
  posters fall back automatically, auth degrades to a disabled state rather
  than an error page.
- **Zeigarnik Effect** — pending applications are an open loop, and My Events
  surfaces them rather than hiding them until resolved.
- **Peak-End Rule** — the QR ticket is the end of the journey and is the most
  designed artefact on the site.

## Open, not yet addressed

- **Doherty Threshold** — `GET /api/register` reads every application across
  every event on each call. At 25 events x 100 seats that is ~2,500 blob reads
  per page load, which will breach the 400ms threshold well before capacity.
  Scope it to `app/{eventId}/` when a slug is supplied.
- **Serial Position Effect** — category tab order is arbitrary. First and last
  are best recalled, so the flagship categories should occupy those slots.
- **Law of Prägnanz** — the events page still stacks three separate notice
  boxes above the list before any event is visible.
