# Information needed from event coordinators — Pravrutti 2026 website

**For the organising team.** The website already carries a description, fee,
tier, rulebook and coordinator contacts for all 26 events. The items below are
the gaps. Each one is listed with what it changes on the site, so it is clear
why it matters and what breaks without it.

Please collect **per event**. Where an event genuinely has no answer (say, it
has no team format), write "N/A" rather than leaving it blank — a blank is
indistinguishable from "not yet asked".

---

## A. Blocking — the site cannot work properly without these

### 1. Day and start time

- **Day:** 15, 16 or 17 October 2026
- **Start time:** e.g. `10:00 AM`
- **Expected duration:** e.g. `3 hours`, or start + end time

**Why it matters.** No event currently has a date or time. Because of that:
- The schedule page has nothing real to show.
- Events cannot be grouped by day anywhere on the site.
- Our own registration page tells participants to "check the schedule to avoid
  overlaps" — which they cannot do.

This is the single largest gap. Everything else is cosmetic by comparison.

### 2. Venue — the specific room

The exact hall, lab, seminar room or block. For example
`Electronics Lab, Block C` or `Seminar Hall 2`.

**Why it matters.** Every event currently shows only "Ramaiah Technology
Campus, Bengaluru", which is the same string on all 26 and tells an arriving
participant nothing. This appears on the event card, the detail panel and the
confirmed ticket.

### 3. Seat capacity

Maximum number of participants (or teams — please say which).

**Why it matters.** Every event is currently capped at a default of **100**. If
the real cap is 40, we will accept 100 applications and have to reject 60 people
after they have paid. If the real cap is 300, we will wrongly show "full".

### 4. Team size

- Minimum team size
- Maximum team size
- Is solo entry allowed?

**Why it matters.** The site says "up to 4 members per team including the lead"
on every event, as fixed text. If any event is solo-only, or allows 5, that text
is wrong for it.

---

## B. Important — visible gaps or things worth confirming

### 5. Poster artwork

One image per event. **1000 x 750 px (4:3), PNG or JPG.**

Every event currently uses an auto-generated placeholder built from its category
colour and name. These look intentional, but they are not real artwork. Real
posters replace them with no code change.

### 6. Confirm what we already hold

Please have each event coordinator confirm, not re-supply:

- **Entry fee** — is the amount on the site correct and current?
- **Coordinator names and phone numbers** — are these people still the contacts,
  and are the numbers reachable? These are published publicly on the site.
- **Description** — still accurate?
- **Rulebook PDF** — is the uploaded version the latest?

### 7. Prize money, if it differs

Prizes are currently derived from the event's tier:

| Tier | 1st | 2nd | 3rd | Pool |
|---|---|---|---|---|
| Visionary | ₹20,000 | ₹15,000 | ₹10,000 | ₹45,000 |
| Creator | ₹10,000 | ₹7,000 | ₹5,000 | ₹22,000 |
| Explorer | ₹5,000 | ₹3,000 | ₹2,000 | ₹10,000 |

**Only reply if an event's prizes differ from its tier.** Otherwise no action.

---

## C. Useful — improves the event page, not required

8. **Eligibility limits** — year, branch or department restrictions, if any.
9. **What to bring** — laptop, specific software, components, safety gear.
10. **Number of rounds** and roughly how each is judged.
11. **Cross-college teams** — allowed, or same-institution only?

> On-the-spot registration is not being offered, so it is no longer asked.
> Everything goes through the site before the deadline.

---

## Suggested reply format

One row per event. A spreadsheet is easiest for us to import.

| Field | Example |
|---|---|
| Event name | ElectroXcape |
| Day | 16 October |
| Start time | 10:00 AM |
| Duration | 3 hours |
| Venue (room) | Electronics Lab, Block C |
| Max participants | 60 |
| Capacity counts | participants / teams |
| Team size | min 2, max 4 |
| Solo allowed | No |
| Fee correct? | Yes |
| Coordinators correct? | Yes |
| Poster attached? | Yes |

---

## Two things for the organising team to settle centrally

**Event count is inconsistent on the site.** The data holds **26** events, the
homepage hero says "25+ ARENAS", and the About page says "22 technical arenas".
Please confirm the correct number so all three can be made to agree.

**Registration deadline.** The site closes registration for every event on
**4 October 2026, 11:59 PM IST**. Confirm this is right, and flag any event that
needs a different deadline.

---

# Additional: dashboard access and feedback

Added after the decision to build a per-event dashboard for event coordinators
plus a master dashboard for organisers. These items are **not optional** — without them
no event coordinator can sign in at all.

## D. Blocking for the dashboard

### 13. Event coordinators' Google email addresses

**This is the single hardest blocker on the whole list.**

The site signs people in with Google. A dashboard account *is* an email address.
We currently hold coordinator **names and phone numbers only** — there is not one
email address in the event data. A phone number cannot be used to sign in.

Please collect **two coordinators per event**:

- **Event Coordinator 1** — full name, **Google email**, phone
- **Event Coordinator 2** — full name, **Google email**, phone

Two is a floor, not a nicety. If one person holds access and loses their phone
on the day, that event's check-in desk is locked out with a queue waiting.

It must be the Google account they will actually sign in with. A college address
only works if it is Google Workspace; a personal Gmail is safer if they are
unsure.

### 14. Desk staff who need check-in access

Anyone scanning tickets at the desk needs their own login. Please give names and
**Google emails**, plus how many separate check-in desks the event will run.

Scanning is the one action that happens under time pressure with a queue
waiting, so it is worth over-provisioning access rather than having volunteers
share one phone.

## E. For feedback analytics

### 15. Custom feedback questions (optional, max 2)

Every event will get the same standard post-event feedback form (overall rating,
would-recommend, free-text comments) so results are comparable across the fest.

If an event wants **one or two extra questions of its own**, give the exact
wording. Leave blank to use the standard form only.

---

## Decisions for the organisers, not event coordinators

These are policy, and should be answered once centrally rather than 26 times:

1. **Can event coordinators see participant contact details** (email, phone), or only
   names and check-in status? This is personal data belonging to students, and
   the safe default is names and status only.
2. **Can event coordinators approve or decline registrations**, or only view and check
   in? Approval affects who gets a paid place, so it may belong with organisers.
3. **Can event coordinators export their participant list** to a spreadsheet?
4. **Can an event coordinator see other events' data?** Default should be no.
5. **Who holds the master organiser account**, and how many people need it?

Nothing here is a website question — it is who is trusted with what. Worth
settling before the dashboard is built, because it determines the permission
model rather than being a setting bolted on afterwards.
