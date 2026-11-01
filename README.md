# Family Trips

A private family trip planner built with Next.js, PostgreSQL and Prisma.

## Development

Use Node 22 and pnpm 9.

1. Copy `.env.example` to `.env` and configure a development PostgreSQL database.
2. Set `APP_URL` to the application's origin. Configure the S3 variables to enable images and payment screenshots.
3. Run:

   ```sh
   pnpm install
   pnpm db:generate
   pnpm db:migrate:deploy
   pnpm dev
   ```

4. Open `/setup` to create the family.

For Railway, provision PostgreSQL and an S3-compatible bucket, configure the variables in `.env.example`, and deploy using `railway.json`.

### Existing databases

The repository now includes an initial migration and two M6 migrations. A fresh database can apply all three normally.

If an existing database was created with `prisma db push`, **back it up and verify that its schema matches the initial migration** before marking the initial migration as applied:

```sh
pnpm exec prisma migrate resolve --applied 20260101000000_initial
pnpm db:migrate:deploy
```

Do not baseline an empty or mismatched database. The M6 migration adds payment instructions, identifies accommodation categories, and removes scoped adjustments when their cost line or category is deleted.

## M6: costs and commitments

- The pure cost engine supports all seven cost bases. Decimal weights and fixed exchange rates use rational arithmetic; largest-remainder rounding reconciles allocations to integer minor units, with member-ID tie breaks.
- `IN` and `MAYBE` count in estimates. Confirmed, happening, completed and archived trips count only `IN`. Only dates inside the trip window count; each selected date represents its evening's night or its daytime meals.
- Rooms are charged for occupied nights and shared only among that night's occupants. Assign rooms and edit child discounts in the captain's cost controls.
- Accommodation categories are explicitly marked, so households booking their own stay are not accidentally excluded from travel, meals or activities. Renaming a category preserves its accommodation setting.
- Captains add, edit and remove categories and lines. Members can adjust their own or their dependents' shares; captains can adjust anyone, at line, category or total scope. Reasons appear in the adjustment history.
- Adjustments do not redistribute money automatically. The difference between the estimate and allocation is a shortfall or surplus. **Spread shortfall** creates deterministic, audited adjustments across attendees.
- Exchange rates are entered by the captain and frozen per trip. `EUR: 1.15` on a GBP trip means **1 GBP = 1.15 EUR**. Updating one rate preserves the others. Missing rates produce an explicit unavailable state, never a fabricated balance.
- Cost snapshots are keyed by all calculation inputs and the engine version. Cost controls recompute snapshots transactionally; opening costs or commitments computes from current attendance, rooms, exclusions and status rather than reusing stale figures.
- `/me` rolls dependents into the guardian, shows per-trip shares, confirmed payments and outstanding balances, and provides category and calculation explanations. Expand a dependent to see their share separately. Summaries convert each trip using its own fixed rate before adding; unpaid completed trips are not labelled settled.
- Payments can include a date, currency, method, note and optional screenshot. Screenshots are limited to 12 MB, re-encoded to WebP without metadata or cropping, and viewable only by their payer and captain through five-minute signed URLs.
- The captain confirms payments and uses the collection sheet to send in-app reminders. Pending payments do not count as paid. Payment instructions are visible only to the captain and `IN` attendees on confirmed trips.
- Up-front expenses are recorded separately from contributions, avoiding double-counting them as payments. Payment processing and automated settle-up remain out of scope.
- Calendar subscriptions and trip downloads include the member's cost share and the configured application URL. Members can disable cost disclosure in Profile's calendar privacy settings.

## Verification

```sh
pnpm test
pnpm test:costs
pnpm typecheck
pnpm lint
pnpm build
```

On memory-constrained development environments, use `NODE_OPTIONS=--max-old-space-size=768 pnpm typecheck` and `NODE_OPTIONS=--max-old-space-size=768 pnpm build` if workers are terminated. These still run the full type and build checks.

`test:costs` enforces at least **95% branch coverage across all production modules in `lib/costs`**, including snapshot loading and commitments. Tests include 300 seeded attendance patterns for the £2,400 allocation, exact fractional-penny rounding, guardian permissions, shortfall spreading, payment confirmation and profile error states.

To test persistence against an already-migrated **disposable PostgreSQL database**, set `M6_TEST_DATABASE_URL` and run:

```sh
pnpm test:costs:db
```

The database test is skipped in ordinary unit runs when that variable is absent. CI creates an isolated PostgreSQL service, applies all migrations and runs the integration test explicitly.
