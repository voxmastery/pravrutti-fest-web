# Luma design reference

**Method.** Values below are read from `getComputedStyle` on live luma.com pages
(event page, event dashboard, apply form, sign-in), plus screenshots of Settings
and the account menu. Screenshot capture failed on Luma's app pages — their
React views time out the extension's script injection — so the visual surfaces
here come from provided screenshots, and everything else is measured from the
DOM. Measured numbers are more useful than images anyway: they can be applied
directly.

This is a reference for *patterns*, not a clone target. Luma's restraint is
worth borrowing; its identity is not — Pravrutti's arcade character is the point
of difference.

---

## 1. The measured system

### Typography

| | Luma | Ours |
|---|---|---|
| Family | system stack (`-apple-system, Inter, Roboto, Segoe UI…`) | Rajdhani / Orbitron display faces |
| Base size | **16px** (515 elements) | 14–16px mixed |
| Secondary | 14px (49), 12px (16) | many |
| Headings | 20–22px, weight 600 | 24–48px, weight 900 |
| **Weights used** | **400 (525), 500 (66), 600 (1)** | 700 / 800 / 900 everywhere |

**The single biggest divergence.** Luma has essentially no bold text. Weight 400
carries the entire product; 500 marks emphasis; 600 appears *once* on the page.
Our UI reaches for `font-black` (900) and `font-bold` by default, which is why
our chrome reads as loud even after adopting Luma's spacing.

Hierarchy on Luma comes from **size and opacity**, not weight.

### Colour

```
base surface      rgb(21, 21, 21)          ← charcoal, not black
fill (primary)    rgba(255,255,255,0.08)   ← 50 uses; the workhorse
fill (subtle)     rgba(255,255,255,0.04)   ← 8 uses; cards
divider           rgba(255,255,255,0.08)
accent            per-calendar, e.g. rgb(248,113,43)
success           rgb(60,189,44)
```

Two observations worth stealing:

1. **The base is `#151515`, not black.** Pure black makes translucent white
   fills look grey and dirty. A charcoal base is why Luma's surfaces read clean.
2. **One fill value does almost everything.** `white/8%` covers inputs, chips,
   secondary buttons and hover states. We currently hand-pick a different
   `#150B1E` / `#2B122C` / `#4A1C3A` per component.

### Radius

| Value | Uses | Applied to |
|---|---|---|
| **1000px** | **37** | chips, badges, avatars, pills — the dominant shape |
| 16px | 9 | primary buttons |
| 24px | 8 | cards |
| 8px | 7 | inputs, small controls |
| 4px | 8 | tight inline elements |

Luma's most common radius is a **full pill**. Anything small and label-shaped is
fully rounded; only containers get a fixed radius. Our badges use `rounded-full`
already, but our buttons sit at 8–12px where Luma uses 16px.

### Spacing

```
4 / 6 / 8 / 12 / 16 px    component-internal gaps (8px most common)
64 px                     between page sections
```

A 4px base scale, and **64px between sections** — far more generous than ours.

### Controls (measured)

| Element | Height | Radius | Fill | Text |
|---|---|---|---|---|
| Input | 38px | 8px | white/8% | 16px |
| Label | — | — | — | 14px / 500 / white 79%, 6px below |
| Primary button | 38px | 16px | accent or white | 16px / 500 |
| Card | — | 24px | white/4% | — |

---

## 2. Surface patterns

### Account menu
Avatar → panel with **name + @username header**, then plain rows: View Profile,
Settings, Sign Out. No icons, no dividers between items — only between header
and body.

### Settings
Tabbed (`Account` / `Preferences` / `Payment`) with sections as: **h2 + one-line
description + bordered container of rows**. Each row is `label left, current
value + chevron right`. Notification preferences read as
`Event Reminders … Email, WhatsApp, Push ›` — the current state is always visible
without opening anything.

### Selection cards
Theme picker uses three **preview cards** with a checkmark on the active one —
showing the choice rather than naming it.

### Linked accounts
Grid of provider cards, each `logo + name + status`, with `✓` when linked and
`+` when not. Same card, two states.

### Danger zone
Destructive action isolated at the very bottom, red, after everything else,
under its own heading.

---

## 3. What maps onto this site

| Our surface | Luma analogue | Status |
|---|---|---|
| Event detail panel | event page | **done** |
| Apply flow | registration modal | **done** |
| Sign-in | sign-in card | **done** |
| Nav account chip | account menu | **done** |
| `/ticket` | ticket / my events | **not started** — closest match, biggest win |
| `/admin` | guest management | **not started** — approve/decline lists |
| `/events` | discover grid | partially |
| `/schedule` | calendar view | not started |
| profile/settings | Settings tabs | doesn't exist |

---

## 4. Recommendations, ranked

1. **Cut font weights.** Move product chrome (forms, panels, tables, settings)
   to 400/500. Keep Orbitron 700–900 for *marquee* only — page titles, the hero,
   event names. This changes the site's feel more than any other single edit.
2. **Lift the base from near-black to charcoal.** Our `--ambient-base` sits
   around `#140a18`; Luma's `#151515` makes translucent fills read clean. Worth
   testing a lighter base under the gradient.
3. **Standardise on one translucent fill.** Replace the per-component palette
   with `white/8%` + `white/4%`, letting the ambient gradient supply colour.
4. **Adopt 16px radius on primary buttons**, keep pills for badges.
5. **Open up section spacing toward 64px.**
6. **Rebuild `/ticket` on the settings-row pattern** — label left, value right,
   in a bordered container. It's currently the least designed page and the one
   every confirmed applicant will see.
7. **Rebuild `/admin` as a guest list** with status chips and bulk approve —
   directly analogous to Luma's guest management, and it becomes load-bearing
   the moment registrations grow past the current seven.

Items 1–3 are global and cheap. Items 6–7 are the two surfaces with no design
at all yet.

---

## 5. Visual pass — captured surfaces

Captured live via the in-app browser (signed out, so public surfaces only;
signed-in views come from provided screenshots). Programmatic scrolling returns
blank frames on Luma's virtualised lists, so long pages are partial.

### Discover

- Page title ~28px/600, muted one-line description beneath. No hero.
- Section header pairs a **title with a muted sub-label** (`Popular Events` /
  `Bengaluru`), with a pill `View All →` right-aligned on the same baseline.
- **Event row** is the core unit, and it is not a card: square thumbnail
  (~64px, 8px radius) on the left, then a stack of muted date/time above a
  white medium-weight title. No border, no fill, no shadow — separation comes
  from spacing alone.
- Rows sit in a **two-column grid**, not a list.
- `LIVE` state is a coloured dot plus coloured label, no pill, no background.
- Category tiles read `Name` over `4K Events` — the count is the whole subtitle.

### Calendar / city page

- **Full-bleed hero photograph** with a heavy gradient scrim resolving to the
  page background at the bottom. Circular glyph badge sits top-left.
- Title split across two weights: small muted `What's Happening in` above a
  large `Bengaluru`.
- Local time shown with a clock glyph — a live, ambient detail.
- Inline `email + Subscribe` where Subscribe is a **white pill**.
- Below the fold, an `Events` heading carries its own toolbar (`Submit Event`,
  RSS, search) rather than a global one.
- **Events group under date headers on a vertical timeline rail** with bullet
  markers — `Today Sunday`, then that day's events indented beneath.

---

## 6. The timeline pattern → our `/schedule`

The single most transferable thing found in the visual pass. Luma renders a
multi-day programme as one continuous vertical rail: a bullet and date header
per day, events indented under it, the rail running through the whole column.

That is exactly the shape of a three-day fest schedule (15–17 October), and it
solves the problem our `/schedule` page has — showing many events across days
without turning into a wall of cards. It also degrades to mobile cleanly, since
the rail simply narrows.

Worth adopting there, with our own colours: rail in `#4A1C3A`, bullets in
`#D64D8D`, date headers in Orbitron and event titles in `font-ui` at weight 500.

## 7. What the visual pass changed

Nothing in sections 1–4 is contradicted. Two additions:

- **Rows beat cards for dense lists.** Our `/events` uses bordered cyber-boxes
  for every event. Luma reserves borders for interactive containers and lets
  spacing separate list items. Our events page would read calmer with rows.
- **Status is colour, not chrome.** `LIVE` is a dot and coloured text. We render
  status as bordered pills with backgrounds. The lighter treatment scales better
  once an event has several states (open / full / closed / waitlist).
