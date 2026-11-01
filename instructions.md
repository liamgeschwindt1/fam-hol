# Family Trips — Build Brief for Copilot

You are building **Family Trips**, a private web app where an extended family (about 14 people, 6 households, across the UK and the Netherlands) plans trips together. Read this whole file before writing code. Build in the milestones listed at the end, one pull request per milestone, and keep every PR deployable to Railway.

---

## 1. Product in one paragraph

Anyone in the family can join by typing their name and adding a photo. They can propose **trips** (an idea, photos of the place, a description, dates). Each trip has an **owner called the Captain**. Family members **join a trip for specific days**, add **accommodation options as links**, **vote**, **comment**, and suggest changes as **proposals** (like Git commits) that the Captain **merges**. The Captain builds a **cost estimate by category**, the app **automatically splits it per person based on the days they attend**, people can **adjust their own share**, and each person sees their **financial commitments** on their profile. There is a **map**, a **library of trips**, and a **calendar** that people can **subscribe to from their own calendar app** so trips appear automatically.

Context: the family is moving from one big annual week to a year of seasonal long weekends (snow, surf, Easter, Christmas, New Year), each organised by a different person. The app must make small trips easy to organise and cheap to run. Small trips often use hotels, so cost splitting must handle rooms and meals, not only villas.

---

## 2. Principles

1. **Zero friction to join.** No email, no password to start. Name plus photo is enough.
2. **Private by default.** Everything sits behind a family invite link. No public pages, no search indexing.
3. **The Captain decides, everyone contributes.** Anyone can suggest. Only the Captain merges.
4. **Money is boring and exact.** Store amounts as integer minor units (pence/cents). Never use floats for money. Every number on screen must be explainable from its inputs.
5. **Calm, warm, editorial design.** See section 12. This must not look like a generic AI or SaaS template.
6. **Mobile first.** Most of the family will use phones. Desktop gets more space, not more features.

---

## 3. Tech stack (decided, do not substitute)

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict), React 19, server actions plus route handlers |
| Database | PostgreSQL on Railway, Prisma ORM |
| File storage | Railway Storage Bucket (S3 compatible) via `@aws-sdk/client-s3` presigned uploads |
| Image processing | `sharp` on the server: resize, strip EXIF GPS, output WebP and a 24px blur placeholder |
| Auth | Own lightweight sessions (see section 5), cookie `ft_session`, HTTP-only, SameSite=Lax, Secure |
| Styling | Tailwind CSS 4 with CSS variables for tokens, plus hand-written CSS for signature components |
| Maps | MapLibre GL JS with MapTiler (free tier) vector tiles; geocoding via MapTiler Geocoding API |
| Calendar | iCalendar feeds per user (`.ics` subscription URLs) using `ical-generator`; optional Google Calendar write in phase 2 |
| Validation | Zod on every server boundary |
| Testing | Vitest for unit tests (cost engine especially), Playwright for 5 key flows |
| Lint and format | ESLint, Prettier, `tsc --noEmit` in CI |
| Realtime | Not required. Use `revalidatePath` and optimistic UI. Polling every 30 s on the trip page for comments is acceptable |
| Hosting | Railway: one `web` service, one Postgres, one Bucket |

Do not add Firebase, Supabase, Clerk, Auth0, Vercel-only features, or a separate backend service.

---

## 4. Roles and permissions

| Role | Who | Can do |
|---|---|---|
| **Member** | Anyone who joined | Create trips (becomes Captain), comment, vote, join days, add accommodation options to trips, open proposals, edit own profile and own cost adjustments |
| **Captain** | Owner of a given trip | Everything a member can, plus edit the trip directly, merge or reject proposals, set cost estimate, choose the winning accommodation, lock dates, transfer captaincy, archive the trip |
| **Admin** | The first member, plus anyone they promote | Manage the family: regenerate invite link, remove a member, promote or demote admins, edit any trip in an emergency (audited) |

Rules:
- A trip has exactly one Captain at a time. Co-captains are out of scope.
- Every mutating action writes a row to `ActivityLog` (actor, trip, type, payload, timestamp). Show it as a "What changed" feed on the trip.
- Server actions must check permissions on the server. Never rely on hidden buttons.

---

## 5. Joining and sessions

- Admin creates the family space on first run via `/setup` (only reachable while no `Family` row exists). Fields: family name, admin name, photo, home currency (default GBP), optional second currency (default EUR).
- The app generates an **invite link**: `/join/{inviteToken}` (32 random bytes, base64url). Admin can regenerate it, which invalidates the old one.
- Join screen: type **name**, add **photo** (camera or upload, cropped square in the browser), optional **household** (pick existing or create), optional **4 digit PIN** for recovery. Submit creates a `Member` and a session.
- Session: random 32 byte token stored hashed (SHA-256) in `Session`, cookie lifetime 400 days, rolling.
- **Return on a new device:** `/welcome-back` shows the member grid (photo and name). Tap yours, enter PIN if set, otherwise an admin must approve (show a "Waiting for approval" screen and a pending request in the admin panel).
- Rate limit join and PIN attempts (5 per 15 minutes per IP and per member).
- Households are a lightweight grouping used for display and for per-household costs. A member belongs to at most one household. Children can be added by an adult as **dependent members** (name, optional photo, `isDependent=true`, `guardianId`, `ageBand`: `adult | child_12_17 | child_5_11 | child_0_4`). Dependents do not log in. Their attendance is edited by their guardian.

---

## 6. Core features in detail

### 6.1 Trips
Fields: title, tagline, description (Markdown, sanitised), season tag (`snow | surf | easter | christmas | nye | summer | city | other`), destination (place name, lat, lng, country), start date, end date (the whole window), status, captain, cover image, gallery images, created and updated timestamps.

Status flow: `IDEA -> PLANNING -> CONFIRMED -> HAPPENING -> DONE`, plus `ARCHIVED`. Captain moves status forward manually. `CONFIRMED` locks the date window (changes then need a proposal).

Creating a trip: a 3 step sheet (Where and when, Photos and description, Season and cover). Destination search with autocomplete drops a pin on a mini map.

### 6.2 Joining days
- A member joins a trip with a **day by day attendance** control: a horizontal strip of day chips from start to end date. Tapping toggles a day; default is "all days". A quick action says "Arrive later" or "Leave earlier".
- Store as `Attendance { tripId, memberId, date, status }` with status `IN | MAYBE | OUT`. Absence of a row means no response.
- Guardians set attendance for dependents.
- The trip page shows a **who is there when** grid (rows people, columns days) with avatars. This is a signature screen; make it beautiful.

### 6.3 Tabs on a trip
`Overview | Program | Stay | Costs | Proposals | Chat`
- **Overview:** cover, description, dates, captain, who is in, map pin, status, activity feed.
- **Program:** day by day itinerary. Each `ProgramItem` has date, optional time, title, notes, optional location, optional link, optional cost tag. Members can suggest items through proposals; the captain edits directly.
- **Stay** (accommodation options, as a tab under Program): see 6.4.
- **Costs:** see section 7.
- **Proposals:** see section 8.
- **Chat:** threaded comments (6.5).

### 6.4 Accommodation options
`StayOption`: title, URL (required), source domain auto detected (Booking, Airbnb, Hotels, other), image (try the page's `og:image` server side with a strict timeout, 5 second limit, SSRF protection, max 2 MB; otherwise let the user upload), price note (free text), **structured estimate** (`totalPrice`, `currency`, `nights`, `rooms`, `capacity`), pros, cons, added by.
- **Voting:** each member gets one vote per trip per option set, can change it any time. Options are `UP | NEUTRAL | DOWN` (three way) and the card shows a tally plus avatars. Captain picks the **chosen** option, which feeds the cost engine.
- Households can also mark an option as "we are booking our own place" (per household booking), which excludes that household from the shared accommodation cost.
- Show options as a comparison grid on desktop, swipeable cards on mobile.

### 6.5 Comments
- Comments on trips, and on individual stay options, program items and proposals (polymorphic `targetType` and `targetId`).
- Threaded one level deep, emoji reactions (a fixed set of 6), `@mention` of members (notifies in the in app inbox), edit and delete own comments, Markdown subset (bold, italic, links, lists).
- In app **inbox** with unread dot for mentions, replies, proposals and cost changes. No email in v1.

### 6.6 Map
- `/map` shows all trips as pins coloured by season, clustered when zoomed out. Click a pin for a card with cover, dates, captain and who is going.
- Filters: season, status, year.
- On a trip, the Overview shows a small map with the destination and optional extra points (stay options with coordinates, program locations).
- Map style: a custom muted style matching the palette (MapTiler custom style or a JSON style with the palette). Not the default blue and white.

### 6.7 Library
- `/trips` is the **library of trips**: past, current and future. Large image cards in an editorial grid.
- Filter by season, year, status, captain, "I'm going". Search by title, place or tag.
- Past trips show a "memory" state: gallery, who went, total spent, a short captain's recap (optional Markdown).

### 6.8 Calendar
- `/calendar` has month, agenda and year views of all trips and personal involvement. Trips the member is attending are solid; trips they have not responded to are outlined.
- **Linkable with people's existing calendars:** every member has a private, unguessable **subscription feed**: `https://{host}/cal/{calendarToken}.ics`.
  - Show three buttons in Profile: **Apple and Outlook** (`webcal://` link), **Google Calendar** (copy URL plus a one line instruction: "Other calendars, From URL"), and **Copy link**.
  - The feed contains every trip the member has `IN` or `MAYBE` days for, as all day events (one event per contiguous run of days), plus the Captain's trips regardless. Event title: `Trip title` (prefix `Maybe: ` for MAYBE). Description holds the trip URL, the chosen stay and the member's cost share.
  - `UID` is stable (`trip-{id}-{runIndex}@familytrips`). Increase `SEQUENCE` and `LAST-MODIFIED` on change. When a member leaves or a trip is archived, emit `STATUS:CANCELLED` for 30 days then drop it.
  - Set `REFRESH-INTERVAL;VALUE=DURATION:PT1H` and `X-PUBLISHED-TTL:PT1H`. Be honest in the UI: Google can take several hours to refresh subscribed feeds; Apple and Outlook are usually faster.
  - Token can be regenerated in Profile (old feed stops working).
- Also provide per trip **Add to calendar** (single `.ics` download) for people who do not want a subscription.
- **Phase 2 (optional, behind a feature flag):** Google Calendar OAuth that writes and updates events directly, so they appear instantly. Keep the `.ics` feed as the default and fallback.

### 6.9 Profile and finances
- Profile: photo, name, household, calendar links, notification preferences, PIN change, "My trips".
- **My commitments** (the key screen): a list per trip showing share total, paid so far, still due, and a status chip (`Estimate`, `Confirmed`, `Settled`). Expand a trip to see the category breakdown and the days that produced it. Top summary: total committed, total paid, total outstanding, in the home currency, with converted values for the second currency.
- Guardians see dependents' shares rolled into their own, with a toggle to view separately.

---

## 7. Cost estimation and automatic split

This is the heart of the app. Implement it as a **pure TypeScript module** (`/lib/costs/engine.ts`) with exhaustive unit tests and no database access, so it can be reasoned about and tested.

### 7.1 Concepts
- `CostCategory` belongs to a trip. Seeded defaults: **Accommodation, Travel, Food and drink, Activities, Transport on site, Other**. The Captain can rename, add and remove.
- `CostLine` belongs to a category: label, `amountMinor` (integer), currency, **basis**, optional note, optional link.
- **Basis** says how a line is shared:
  | Basis | Meaning |
  |---|---|
  | `PER_PERSON_PER_NIGHT` | `amount` per attending person per night |
  | `PER_PERSON_FLAT` | `amount` per person who attends at least one day |
  | `PER_ROOM_PER_NIGHT` | `amount` per room per night; each household or person assigned to a room splits it |
  | `SHARED_BY_PERSON_NIGHTS` | A fixed total split by each person's share of total person-nights |
  | `SHARED_EQUAL` | A fixed total split equally among attendees |
  | `PER_HOUSEHOLD_FLAT` | `amount` per household with at least one attendee |
  | `PER_PERSON_PER_DAY_FOOD` | `amount` per person per day (meals), with optional meals per day count |
- **Age weights** per trip (Captain editable): adult 1.0, 12 to 17 = 1.0, 5 to 11 = 0.5, 0 to 4 = 0.0. Applied to person-based bases. Default is configurable per line (checkbox "apply child discounts").
- A line can have a **currency different from the trip currency**; convert using the trip's fixed exchange rate (Captain sets it once, default from a free rates API fetched at creation, then frozen until the Captain updates it). Store the rate and date.

### 7.2 Inputs the engine receives
```ts
type EngineInput = {
  trip: { id: string; startDate: string; endDate: string; currency: 'GBP'|'EUR'; fxRates: Record<string, number> };
  members: { id: string; householdId: string | null; ageBand: AgeBand; guardianId?: string }[];
  attendance: { memberId: string; date: string; status: 'IN'|'MAYBE'|'OUT' }[];   // nights are derived from dates
  lines: CostLine[];
  rooms?: { id: string; label: string; memberIds: string[] }[];
  ageWeights: Record<AgeBand, number>;
  includeMaybe: boolean;               // default true for estimates, false when CONFIRMED
  adjustments: { memberId: string; lineId?: string; categoryId?: string; deltaMinor?: number; overrideMinor?: number; reason?: string }[];
  excludedHouseholdIds: string[];      // households booking their own accommodation
}
```
### 7.3 Outputs
```ts
type EngineOutput = {
  perMember: { memberId: string; totalMinor: number; byCategory: Record<string, number>; byLine: Record<string, number>; nights: number; explain: ExplainStep[] }[];
  totals: { estimateMinor: number; allocatedMinor: number; unallocatedMinor: number };
  warnings: string[];   // e.g. "No one attends on 12 April but a line applies"
}
```
### 7.4 Rules
1. A **night** is the evening of a date. A person's nights are the dates marked `IN` (and `MAYBE` if `includeMaybe`). For lines that are daytime (activities, food) use days instead; each basis declares `unit: 'night' | 'day'`.
2. Allocation is deterministic. Rounding: compute exact rational shares, round each to integer minor units using the **largest remainder method** so shares sum exactly to the line total. Ties broken by member id.
3. If a line has zero eligible people, put its amount in `unallocatedMinor` and emit a warning. Never silently drop money.
4. **Adjustments** (manual): a member (or the Captain) can change a share at line, category or member level, as `+/- delta` or an `override`. When a member adjusts, the difference is **redistributed to nobody** by default and shown as `Shortfall` or `Surplus` to the Captain (so the trip's books always show whether the estimate is fully covered). Captain can choose "spread shortfall across everyone" as a one click action that creates adjustments.
5. Members can only adjust **their own share** (and their dependents'). The Captain can adjust anyone. Every adjustment needs an optional reason, is logged, and is visible to the Captain.
6. `explain` is a human readable trace: "Accommodation, Villa Mar: £2,400 shared by 38 person-nights. You have 9. Your share is £568.42." The UI shows this on tap. If a number cannot be explained, it is a bug.
7. Recalculate whenever attendance, lines, rooms, weights or adjustments change. Cache results in `CostSnapshot` rows keyed by a hash of the inputs; keep the latest per trip for the profile screen.

### 7.5 Payments and contributions
- `Payment`: tripId, fromMemberId, toMemberId (usually the Captain or `null` for "to the pot"), amountMinor, currency, method (`BANK | CASH | OTHER`), date, note, `confirmedByCaptain` boolean.
- Members log "I paid £X" with an optional screenshot; Captain confirms. Profile shows **paid, due, outstanding** per trip.
- Captain's **Collection sheet**: a table of members, share, paid, outstanding, with a "Send reminder" action (in app inbox only in v1).
- No real payment processing in v1. Show the Captain's bank details (free text field, shown only to attendees on CONFIRMED trips).
- "Other money" such as the Captain paying a deposit up front is recorded as an `Expense` (who paid, category, amount) so the app can show who is owed what. Optional, phase 2: a settle up suggestion.

---

## 8. Proposals ("commits") and merging

The family should be able to suggest changes without stepping on the Captain, with a Git like feel but a plain language UI. Use the words **Suggest**, **Review**, **Merge**.

### 8.1 Model
- A **Proposal** targets one trip, has a title, a description, an author, a status (`OPEN | MERGED | REJECTED | WITHDRAWN | CONFLICTED`), a **base revision** (the trip revision it started from) and a list of **changes**.
- A **Change** is a typed operation, not a raw diff:
  `TRIP_FIELD_SET`, `PROGRAM_ITEM_ADD|UPDATE|REMOVE`, `STAY_OPTION_ADD|UPDATE|REMOVE`, `COST_LINE_ADD|UPDATE|REMOVE`, `DATES_SET`, `IMAGE_ADD|REMOVE`, `ATTENDANCE_BULK` (for a guardian). Each stores `before` and `after` JSON.
- A trip has a monotonically increasing `revision` integer. Every merge or direct captain edit creates a `TripRevision` row holding a full JSON snapshot plus the actor and a summary.

### 8.2 Workflow
1. A member opens **Suggest changes** on a trip. The UI enters a **draft mode** where every editable field and list is editable inline, tracking changes as they go. A sticky bar shows "3 changes" with **Review and submit**.
2. Submitting creates an `OPEN` proposal. Others can **comment** and **react** and **+1** it.
3. The Captain opens **Review**: a visual diff (old to new, side by side, with added items in green, removed in red, using the palette, not raw JSON). Each change has a checkbox so the Captain can **merge selected changes** and leave the rest (partial merge). Buttons: **Merge**, **Merge selected**, **Request changes**, **Reject** (reason required).
4. On merge the server, in one transaction: checks the base revision, applies the changes to live tables, writes a `TripRevision`, marks the proposal `MERGED`, writes `ActivityLog`, recomputes costs, bumps calendar `SEQUENCE`, notifies the author and attendees.
5. **Conflicts:** if the trip `revision` moved since the proposal's base and a change touches a field that has since changed, mark that change `CONFLICTED` with both versions shown. Non conflicting changes still merge. The author can **Update proposal** (rebase) which re-applies their changes on the new base and flags remaining conflicts for them to resolve.
6. Captains editing directly bypass proposals but still create a revision.

### 8.3 History
- Trip **History** drawer: list of revisions with actor, summary, time. Open any revision to view it read only. Captain can **Restore** a previous revision (creates a new revision).

### 8.4 Voting inside proposals
A proposal of type `STAY_OPTION_ADD` or `COST_LINE_ADD` can be voted on like an option. Merge is still the Captain's decision. Show the tally to the Captain at review.

---

## 9. Data model (Prisma outline)

Use this as the starting point; refine names but keep the relationships and constraints. All IDs are `cuid2`. All tables have `createdAt` and `updatedAt`. Money fields are `Int` minor units with an explicit currency column.

```prisma
model Family { id String @id; name String; inviteTokenHash String; homeCurrency String; secondCurrency String? ; members Member[]; trips Trip[] }

model Household { id String @id; familyId String; name String; members Member[] }

model Member {
  id String @id; familyId String; householdId String?
  name String; photoKey String?; isAdmin Boolean @default(false)
  isDependent Boolean @default(false); guardianId String?; ageBand AgeBand @default(ADULT)
  pinHash String?; calendarToken String @unique
  sessions Session[]; trips Trip[] @relation("captain")
}
model Session { id String @id; memberId String; tokenHash String @unique; expiresAt DateTime; userAgent String? }
model DeviceRequest { id String @id; memberId String; status String; tokenHash String; createdAt DateTime }

model Trip {
  id String @id; familyId String; captainId String
  title String; tagline String?; descriptionMd String; season Season; status TripStatus @default(IDEA)
  placeName String?; lat Float?; lng Float?; country String?
  startDate DateTime @db.Date; endDate DateTime @db.Date
  coverImageId String?; currency String; fxRatesJson Json?; fxAsOf DateTime?
  revision Int @default(1); chosenStayId String?
  ageWeightsJson Json; recapMd String?; archivedAt DateTime?
}
model TripImage { id String @id; tripId String; storageKey String; width Int; height Int; blurDataUrl String; caption String?; credit String?; sort Int; uploadedById String }
model Attendance { tripId String; memberId String; date DateTime @db.Date; status AttendStatus; @@id([tripId, memberId, date]) }
model ProgramItem { id String @id; tripId String; date DateTime @db.Date; time String?; title String; notes String?; placeName String?; lat Float?; lng Float?; url String?; sort Int }
model StayOption { id String @id; tripId String; title String; url String; sourceDomain String?; imageKey String?; priceNote String?; totalPriceMinor Int?; currency String?; nights Int?; rooms Int?; capacity Int?; pros String?; cons String?; addedById String; lat Float?; lng Float? }
model StayVote { stayOptionId String; memberId String; value VoteValue; @@id([stayOptionId, memberId]) }
model HouseholdOwnStay { tripId String; householdId String; note String?; @@id([tripId, householdId]) }
model Room { id String @id; tripId String; label String; stayOptionId String? ; members RoomMember[] }

model CostCategory { id String @id; tripId String; name String; sort Int; colour String? }
model CostLine { id String @id; categoryId String; tripId String; label String; amountMinor Int; currency String; basis CostBasis; unit CostUnit; applyAgeWeights Boolean @default(true); mealsPerDay Int?; note String?; url String?; sort Int }
model CostAdjustment { id String @id; tripId String; memberId String; lineId String?; categoryId String?; deltaMinor Int?; overrideMinor Int?; reason String?; createdById String }
model CostSnapshot { id String @id; tripId String; inputHash String; outputJson Json; computedAt DateTime }
model Payment { id String @id; tripId String; fromMemberId String; toMemberId String?; amountMinor Int; currency String; method String; paidOn DateTime @db.Date; note String?; proofKey String?; confirmedAt DateTime?; confirmedById String? }
model Expense { id String @id; tripId String; paidByMemberId String; categoryId String?; amountMinor Int; currency String; description String; receiptKey String? }

model Comment { id String @id; tripId String; targetType String; targetId String; parentId String?; authorId String; bodyMd String; editedAt DateTime?; deletedAt DateTime? }
model Reaction { commentId String; memberId String; emoji String; @@id([commentId, memberId, emoji]) }
model Mention { commentId String; memberId String; @@id([commentId, memberId]) }

model Proposal { id String @id; tripId String; authorId String; title String; descriptionMd String?; baseRevision Int; status ProposalStatus; mergedAt DateTime?; mergedById String?; rejectReason String?; changes Change[] }
model Change { id String @id; proposalId String; type ChangeType; targetId String?; beforeJson Json?; afterJson Json; state ChangeState @default(PENDING) }
model ProposalSupport { proposalId String; memberId String; @@id([proposalId, memberId]) }
model TripRevision { id String @id; tripId String; revision Int; snapshotJson Json; actorId String; summary String; proposalId String? ; @@unique([tripId, revision]) }

model Notification { id String @id; memberId String; type String; payloadJson Json; readAt DateTime?; createdAt DateTime }
model ActivityLog { id String @id; tripId String?; actorId String; type String; payloadJson Json }
```
Enums: `AgeBand`, `Season`, `TripStatus`, `AttendStatus (IN MAYBE OUT)`, `VoteValue (UP NEUTRAL DOWN)`, `CostBasis`, `CostUnit (NIGHT DAY FLAT)`, `ProposalStatus`, `ChangeType`, `ChangeState (PENDING MERGED SKIPPED CONFLICTED)`.

Add indexes on every foreign key and on `(tripId, date)` for attendance.

---

## 10. Routes and pages

| Route | Purpose |
|---|---|
| `/setup` | First run only |
| `/join/[token]` | Join the family |
| `/welcome-back` | Pick yourself on a new device |
| `/` | Home: next trip hero, "needs your reply" list, latest activity, small map |
| `/trips` | Library |
| `/trips/new` | Create trip sheet |
| `/trips/[id]` | Trip with tabs (Overview, Program, Stay, Costs, Proposals, Chat) |
| `/trips/[id]/suggest` | Draft mode |
| `/trips/[id]/proposals/[pid]` | Review and merge |
| `/map` | Map |
| `/calendar` | Calendar |
| `/me` | Profile and My commitments |
| `/inbox` | Notifications |
| `/admin` | Family admin |
| `/cal/[token].ics` | Calendar feed (no session, token auth) |
| `/api/upload` | Presigned upload helper |
| `/api/health` | Healthcheck for Railway |

Use server actions for mutations and route handlers only for the feed, uploads and health.

---

## 11. Security and privacy

- Every query is scoped by `familyId` and checked against the session. Add a `requireMember()` and `requireCaptain(tripId)` helper and use them in every action.
- Upload: only image MIME types, max 12 MB, re-encode with `sharp` (this strips EXIF including GPS), random keys, no original filenames in URLs. Serve through short lived signed URLs or a proxy route with cache headers.
- URL unfurl: block private IP ranges and redirects to them (SSRF), 5 s timeout, 2 MB cap, no cookies.
- Sanitise Markdown (`rehype-sanitize`), no raw HTML. Links get `rel="noopener noreferrer"` and `target="_blank"`.
- CSRF: server actions with same origin checks; cookie is SameSite=Lax.
- `robots.txt` disallows all, plus `<meta name="robots" content="noindex">` on every page and `X-Robots-Tag: noindex` header.
- Calendar token is 32 bytes random, shown only to its owner, regenerable. Feed reveals titles and dates only, never payment amounts beyond the member's own share line in the description (which can be disabled in Profile).
- Children's photos: dependents have photo optional and default to initials. Only family members can ever see images.
- Log nothing sensitive. No analytics or third party trackers.
- Backups: enable Railway Postgres backups; add an admin "Export everything" button (JSON plus a zip of images).

---

## 12. Design direction (read carefully)

The family said: **very nicely designed, not AI slop.** That means we have a point of view and we commit to it.

### 12.1 Feeling
A warm, printed **travel journal and field guide**. Think a well made paper atlas, a Polaroid wall, and the calm confidence of a good editorial magazine. Photography leads. Interfaces recede.

### 12.2 Banned
- Inter, Roboto, Arial, system-ui as the visible brand font, and Space Grotesk.
- Purple to blue gradients, glassmorphism, neon glows, blurry gradient blobs.
- Emoji as icons, generic 3D illustrations, stock "team" images.
- Cards with a coloured left border, pill badges everywhere, rounded-2xl on everything.
- Center aligned hero text over a gradient with two buttons.
- Lorem ipsum. Use real family sample data (see seeds).

### 12.3 Typography (Google Fonts, load with `next/font`, `display: swap`)
- **Display:** *Instrument Serif* for trip titles, big numbers and page headings (sizes large, tight leading, optical sizing by size). Italic used for taglines and place names.
- **Text and UI:** *Hanken Grotesk* (400, 500, 600). Body 16 to 17 px, line height 1.55.
- **Numbers and labels:** *DM Mono* (400, 500) for money, dates in tables, small caps labels. Use `font-variant-numeric: tabular-nums` everywhere money appears.
- Scale (rem): 0.8125, 1, 1.125, 1.375, 1.75, 2.5, 3.75, 5.5. Use no more than five sizes on one screen.
- Proper typographic quotes and apostrophes everywhere; no hyphen used as a dash.

### 12.4 Colour tokens (CSS variables)
Light is the default; provide a considered dark mode (not an inversion) using `prefers-color-scheme` plus a manual toggle.
```
--paper:      #F6F1E7   /* page background, warm off-white */
--paper-2:    #EDE5D4   /* raised panels */
--ink:        #1E2A32   /* primary text, deep blue-black */
--ink-soft:   #4A5862   /* secondary text */
--rule:       #D9CFBA   /* hairlines */
--sea:        #1F6F78   /* primary accent, links, focus */
--sea-deep:   #134850
--clay:       #C4553A   /* highlight, destructive, the Captain's mark */
--sun:        #E8A93B   /* warm accent, MAYBE, stars */
--moss:       #5E7F4F   /* success, IN */
--snow:       #DCE7F0   /* season chip: snow */
--dusk:       #2B2F4A   /* dark mode paper and map night */
```
Season colours (used on map pins, calendar bars, chips, and as a subtle tint on trip pages): snow `#7FA6C9`, surf `#2C8FA3`, easter `#A9C46C`, christmas `#9C3B3B`, nye `#4B3F8C`, summer `#E8A93B`, city `#8A7F72`.
Contrast: all text at least 4.5:1 on its background; check dark mode too.

### 12.5 Layout and components
- Generous whitespace, a **12 column grid** with asymmetric editorial layouts on desktop (a trip page has a wide image column and a narrow, sticky "details" column).
- Trip cards: big image with a thin paper border (Polaroid feel) and slight randomised rotation (max 1.2 degrees) in the library on hover only, never on mobile. Title in Instrument Serif over a paper strip, not over the photo.
- Hairline rules and small caps labels (DM Mono, 11 to 12 px, letterspaced) rather than boxes inside boxes.
- **Avatars** are photos with a thin paper ring; stacked avatars overlap by a quarter.
- **Who is there when** grid: day columns with a tiny serif weekday and date; cells are filled stamps (moss for IN, hatched sun for MAYBE, empty rule for none).
- **Money**: large serif numerals for totals, mono for tables, always with currency code shown small. Negative values use clay, not red-green pairs; never rely on colour alone (add `+` and `-` signs or words).
- **Diff view** (proposals): serif body text with inline marked changes (underline moss for additions, strikethrough clay for removals), not a code diff.
- **Icons:** Phosphor (regular weight) via `@phosphor-icons/react`, consistent 1.5 px strokes. No emoji in UI chrome (reactions are the one exception, using a fixed set).
- **Map:** custom muted style (paper land, sea water, hairline roads), pins as small paper tags with a season colour dot, a drop shadow of 1 px.
- **Motion:** subtle and purposeful. Page transitions fade and 8 px rise (200 ms). Cards ease on hover (transform, 150 ms). Respect `prefers-reduced-motion`. No parallax.
- **Empty states** are friendly and specific ("No trips yet. Be the first to suggest a long weekend.") with a small line illustration drawn in the app's own style (simple SVG, one stroke weight, `--ink` and one accent).
- **Photography:** `next/image`, WebP, blur-up placeholders, `object-fit: cover`, art directed crops with a focal point the uploader can set. Show EXIF-free images only.
- **Accessibility:** WCAG 2.2 AA, visible focus rings (2 px `--sea`, offset 2), labels on every input, touch targets 44 px, full keyboard flow, `aria-live` for toasts, alt text field on uploads (default to caption).
- **Copy tone:** friendly, short, adult. "Reply" not "RSVP now!". "You’re in for 3 of 4 nights" not "Success!".

### 12.6 Signature moments (build these well)
1. **Home hero:** the next trip as a large cover with a countdown in serif numerals, avatars of who is in, and a single "Update my days" button.
2. **Trip page header:** full bleed cover, title overlapping the photo edge on a paper strip, captain shown as "Captained by [avatar] Name" with a small clay star.
3. **Who is there when** grid (6.2).
4. **My commitments** (6.9), laid out like a tidy receipt: serif total, hairline rows, a single "Show how this is worked out" link.
5. **Proposal review**, laid out like an editor’s markup.

---

## 13. Railway deployment

- Repo root contains the Next.js app. Add `railway.json`:
```json
{ "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK" },
  "deploy": { "startCommand": "npx prisma migrate deploy && node .next/standalone/server.js",
              "healthcheckPath": "/api/health", "healthcheckTimeout": 60,
              "restartPolicyType": "ON_FAILURE", "restartPolicyMaxRetries": 5 } }
```
  (Set `output: 'standalone'` in `next.config.ts`. If standalone start fails, fall back to `next start -p $PORT`.)
- Services: `web`, Railway **Postgres**, Railway **Bucket**. Reference Postgres via `${{Postgres.DATABASE_URL}}`.
- Env vars: `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MAPTILER_KEY`, `FEATURE_GOOGLE_CALENDAR` (default `false`), `NODE_ENV`.
- Provide `.env.example` and a `README.md` with first deploy steps (create project, add Postgres and Bucket, set vars, deploy, open `/setup`).
- `prisma/seed.ts` (run only in dev) creates a sample family and trips (see 15).
- Add a GitHub Actions workflow: install, `prisma generate`, lint, typecheck, unit tests, Playwright smoke tests on PRs.
- Node 22. pnpm.

---

## 14. Non functional requirements

- Lighthouse on mobile for `/` and a trip page: Performance 85 or more, Accessibility 95 or more.
- LCP image preloaded; JS bundle for the library page under 200 KB gzipped (lazy load MapLibre only on map routes).
- All dates are stored as `date` (no time) in the trip's local calendar to avoid timezone drift; display in the viewer’s locale (`en-GB`).
- Support English only in v1, but keep strings in a single `messages/en.ts` so Dutch can be added.
- Currency formatting via `Intl.NumberFormat`.
- No feature may require an email address.

---

## 15. Seed data (use real looking content, no lorem ipsum)

Create one family with households: **Parents** (2), **Liam** (1), **Maarten and Paula’s household** (4), **Tim’s household** (3), **Maaike’s household** (2), **Ben and Jae** (2). Use placeholder avatar photos generated as simple initials on a paper background.
Trips:
1. **Easter and the 70th**, Easter 2028 (3 to 17 April holiday window; party Saturday 8 April 2028), status PLANNING.
2. **Christmas in the UK**, December 2027, status CONFIRMED.
3. **Snow weekend**, February 2028, status IDEA.
4. **Surf weekend**, June 2028, status IDEA.
5. **Barcelona**, a past long weekend in 2025 with five attendees, status DONE, with a recap.
Include a few stay options with votes, a cost estimate on Easter with all seven bases exercised, one open proposal with a conflict, and comments with mentions.

---

## 16. Milestones (one PR each)

**M0. Foundation:** repo, tooling, Tailwind tokens, fonts, layout shell, `/api/health`, Prisma schema and first migration, Railway config, CI.
**M1. Family and members:** `/setup`, invite link, join flow with photo crop and upload, sessions, welcome back, households and dependents, admin page.
**M2. Trips and library:** create and edit trip, image gallery and cover, library with filters, trip Overview tab, status flow, activity log.
**M3. Days, program, stay:** attendance strip and grid, program tab, stay options with unfurl and voting, chosen stay.
**M4. Chat and inbox:** comments, replies, reactions, mentions, notifications.
**M5. Map and calendar:** map page, trip mini map, calendar views, `.ics` feed, per trip download, subscription UI.
**M6. Costs:** engine with unit tests (target 95% branch coverage on `/lib/costs`), costs tab, adjustments, snapshots, profile "My commitments", payments and collection sheet.
**M7. Proposals:** draft mode, review UI, partial merge, conflicts, revisions and restore.
**M8. Polish:** dark mode, empty states, motion, accessibility pass, Lighthouse, Playwright flows, README and docs.
**Phase 2 (flagged):** Google Calendar OAuth write, settle up, email or push notifications, Dutch translation, PDF trip sheet export.

---

## 17. Acceptance criteria (excerpt, write tests for these)

1. A new person opens an invite link, types a name, adds a photo and lands on Home within three taps.
2. A member creates a trip with a map pin and cover; it appears in the library, on the map and on the calendar.
3. Two members mark different days; the grid shows each correctly; guardian edits a child’s days.
4. A member pastes an Airbnb link; the card appears with title and image (or a clean fallback); votes update tallies and the Captain picks a winner.
5. The Captain adds a villa line of £2,400 using `SHARED_BY_PERSON_NIGHTS`; shares sum to exactly £2,400.00 for any attendance pattern (property test with random attendance).
6. A member overrides their own share; the Captain sees a shortfall and can spread it with one click.
7. My commitments equals the sum of per trip shares; every figure has a working "how is this worked out" explanation.
8. Subscribing to the `.ics` feed in Apple Calendar shows the trip; changing trip dates updates the event on the next refresh with `SEQUENCE` increased; removing yourself cancels it.
9. A member submits a proposal with three changes; the Captain merges two and skips one; the live trip and revision history reflect exactly that. A stale proposal shows a conflict and can be updated.
10. A non member hitting any URL (except join and the feed token) is redirected to the join explanation page with no data leakage.

---

## 18. How to work

- Ask nothing; if something is ambiguous, pick the simplest option that fits section 2, note it in the PR description, and move on.
- Keep PRs small and focused; each PR description lists what was built, what was skipped, screenshots at 390 px and 1280 px widths.
- Write the cost engine first with tests, before any UI that depends on it.
- Never invent real family data beyond the seed in section 15.
- When you are unsure about design, re-read section 12 and choose the more restrained, editorial option.