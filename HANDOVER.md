# Keyvaga: developer handover

*Your key to the ultimate vacation getaway.* A vacation rental marketplace: owners list properties, guests book and pay, owners hire service providers. Three portals (guest, owner, service provider) plus admin, one login.

This document is for the developer taking over. Read it with `README.md` (setup and commands) and the original product brief (the "Keyvaga Build Spec", which the founder has).

- **Repository:** `github.com/mgilbert128/keyvaga` (branch `main`, deployed automatically)
- **Live preview:** https://keyvaga.vercel.app (Stripe **test mode**, demo data)
- **State at handover:** build phases 1–4 of the spec are done. Phases 5–7 are not started. Details are in [What's done](#whats-done) and [What's next](#whats-next).

---

## 1. Stack

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.4** (App Router), React 19, TypeScript (strict) | `cacheComponents` and `partialPrefetching` are **on** (see [Gotchas](#gotchas)). Bundled docs are in `node_modules/next/dist/docs/`; read them, because APIs differ from older Next. |
| Styling | Tailwind CSS 4 | All colors and radii are design tokens in `src/app/globals.css` (`--kv-*`). Brand color = `--kv-brand`. |
| Database | PostgreSQL 16 + **Prisma 7** | `prisma.config.ts` (not `.env`) holds the datasource. The client is generated to `src/generated/prisma` (git-ignored, built on `postinstall`). Uses the `@prisma/adapter-pg` driver adapter. |
| Auth | Custom, server-side sessions | bcrypt passwords; random token in an httpOnly cookie, stored as a SHA-256 hash in `Session`. No third-party auth. |
| Payments | **Stripe** (SDK 23, API `2026-10-28`) | Payment Element; PaymentIntents with a saved card; Connect **Express** accounts with separate charges and transfers. |
| Files | **Vercel Blob** (private store, OIDC via `BLOB_STORE_ID`) | Photos go through our API (resized in the browser). Videos upload directly from the browser (presigned). There's a local-disk fallback for development. |
| Hosting | Vercel (Hobby) + Neon Postgres (Vercel Marketplace) | A daily cron is configured in `vercel.json`. |
| Tests | Vitest | Unit, DB (real Postgres) and Stripe test-mode integration suites. |

## 2. Run it locally

See `README.md` for the full steps. In short:

```bash
cp .env.example .env            # set DATABASE_URL
npm install
npx prisma migrate deploy
npm run db:seed                  # demo users/listings; password keyvaga-demo-123
npm run dev
```

Demo accounts: `guest@`, `owner@`, `provider@` and `admin@keyvaga.test` (the demo admin exists only locally; production deletes it). Without Stripe keys the site works except checkout. Without Blob, uploads go to `./.uploads` in development.

## 3. Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (or `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`) | Set by the Neon integration | App uses the pooled URL; migrations use the unpooled one (`prisma.config.ts`). |
| `BLOB_STORE_ID` (or `BLOB_READ_WRITE_TOKEN`) | Set by the Vercel Blob integration | Photo/video storage. `KEYVAGA_BLOB_ACCESS=public\|private` overrides the access guess. |
| `ADMIN_EMAILS` | Manual | Comma-separated. These accounts get the `ADMIN` role at login. Admin is never self-assigned. |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Manual | Test keys (`sk_test_`, `pk_test_`) until launch. |
| `STRIPE_WEBHOOK_SECRET` | Manual | Endpoint `/api/stripe/webhook`; events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated` (including connected accounts). |
| `CRON_SECRET` | Manual | Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/cron/daily`. |
| `KEYVAGA_LOCAL_UPLOADS=true` | Dev/test only | Allows local-disk uploads in a production build. |

The founder holds all accounts (GitHub, Vercel, Neon, Stripe). **Ask for invitations; don't accept shared passwords or keys over chat.**

## 4. Code map

```
prisma/
  schema.prisma            data model (comments explain each field)
  migrations/              includes HAND-WRITTEN SQL at the bottom of several files (see below)
  seed.ts                  demo data; runs on every Vercel build while KEYVAGA_DEMO=true
src/
  proxy.ts                 (Next 16's "middleware") fast redirect to /login for portals; NOT the security gate
  app/
    (site)/                public pages: home, search, stays/[slug], book/[id] checkout, login/signup, marketing
    (portals)/             guest (/trips, /saved, /messages, /profile), owner (/owner/*), /provider, /admin
    actions/               server actions: auth, listings, bookings, calendar, messages, guest
    api/                   photo/video upload, local file serving, Stripe webhook, daily cron, private photo proxy
  lib/
    auth/                  dal.ts = the permission gate (requireUser/requirePortal); roles, sessions, passwords
    booking-money.ts       ALL fee / deposit / refund math (pure, unit-tested)
    pricing.ts             nightly rates (season > weekend > base), weekly/monthly discounts (pure)
    bookings.ts            booking engine: hold → Stripe → confirm, balance charge, cancel/refund, payouts, daily job
    payouts.ts             Stripe Connect onboarding + status
    listing-policy.ts      who can edit/review listings; listing status transitions
    storage.ts             Vercel Blob / local storage behind one interface
    dates.ts               calendar-day maths (UTC midnight, [start, end) ranges)
  components/              UI (ui/, layout/, owner/, booking/, listings/, messages/, search/)
tests/
  unit/                    pure logic (money, pricing, dates, permissions, validation)
  db/                      needs TEST_DATABASE_URL (separate, disposable DB)
  stripe/                  full money flow against Stripe TEST mode (STRIPE_INTEGRATION=1)
```

### How the important parts work

- **Permissions.** Every protected page calls `requirePortal(...)` from `src/lib/auth/dal.ts`, and every server action re-checks ownership (`canEditListing`, booking guest/owner checks). Another user's resources return 404. `proxy.ts` is only an optimization.
- **Double-booking.** Postgres exclusion constraint `Booking_no_overlap` (hand-written in the first migration) on `daterange(checkIn, checkOut, '[)')` for `PENDING_PAYMENT` and `CONFIRMED`. Checkout holds expire after 15 minutes (`holdExpiresAt`). Expired holds are ignored by availability queries and cleaned up by `expireStaleHolds()`.
- **Money (decided by the founder).**
  - Fees: 5% guest service fee + 5% host fee.
  - Payment schedule: 30% at booking with the card saved (`setup_future_usage: off_session`). The balance is charged off-session by the daily cron 30 days before check-in; bookings within 30 days pay in full.
  - Cancellation: Flexible, Moderate and Strict policies (`POLICY_INFO` in `booking-money.ts`). Refunds are based on what's been paid, and a cancellation never triggers a new charge. Owner cancellation = full refund.
  - Owner payouts: Stripe Transfers with `source_transaction` once check-in has passed, if the owner's Express account is payouts-enabled.
  - Records: every movement is recorded in `Payment`. DB check constraints enforce non-negative amounts and that `dueNowCents + balanceCents = totalCents`.
- **Payment state sync.** `syncPaymentIntent()` is idempotent. It runs from the checkout return page (`/trips/[id]?paid=1`) **and** the webhook, so things work even before the webhook is configured. It also handles the edge case "hold expired while paying and someone else booked" (auto-refund).
- **Listing lifecycle.** DRAFT → (owner submits; needs a title, summary, address, price and 1+ photos) → PENDING_REVIEW → (admin approves at `/admin`) → PUBLISHED ⇄ PAUSED. A rejection returns to DRAFT with `reviewNote`.
- **Proof of ownership.** `src/lib/documents.ts` (rules) plus `ListingDocument` and `DocumentAccessLog`.
  - Owners need a deed, tax bill or utility bill. Managers need a management license and agreement. Both need the rental permit when required.
  - Uploads go to `/api/listings/[id]/documents` and are stored privately (`putPrivateDocument`: a private Blob, or `.private-uploads` locally). They're viewed only via `/api/documents/[id]` (listing owner or admin), and every action is logged.
  - Submitting requires the documents to be uploaded; publishing requires each one to be approved (`documentsApproved`).
  - Listings that were live before this feature stay live and show an owner reminder. Consider a retention policy, and disclose document handling in the privacy policy.
- **Privacy.** Exact address and check-in instructions are only shown to a confirmed guest from `accessReleaseDays` before check-in (`src/lib/checkin.ts`). Public queries never select address fields.

## 5. Gotchas

1. **Next 16 Cache Components.** Anything reading cookies, `searchParams`, the current time or calling Stripe must be inside `<Suspense>`, and pages call `await connection()` before time- or Stripe-dependent work. Otherwise you get "uncached data / new Date() during prerender" errors, or partial prefetch firing Stripe calls.
2. **Hidden previous pages.** Next keeps visited pages mounted but hidden (React Activity). In Playwright tests use visible-only locators (`h1:visible`), or you'll match stale pages.
3. **Prisma migrations.** `prisma migrate dev` refuses to run non-interactively when it has warnings. Generate with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql`, append any hand-written SQL, then `npx prisma migrate deploy`. Prisma 7 does **not** auto-run `generate` after migrating.
4. **Hand-written SQL lives at the bottom of migrations:** the exclusion constraint, `btree_gist`, and CHECK constraints. Keep them when editing models.
5. **Stripe SDK.** Uses `Stripe.createFetchHttpClient()` (works on Vercel and behind proxies). On this API version `payment_method_types` is rejected; use `automatic_payment_methods`. Stripe also nudges toward Accounts v2; we use v1 Express accounts, which still work.
6. **Server-action success messages.** Several actions revalidate the page so the form disappears (cancel, review). The page itself shows the new state instead of a toast.
7. **"Today"** is computed in `America/Chicago` (`todayIn()` in `dates.ts`). Make this per-listing when you add time zones.
8. **`Booking.nightlyCents`** stores the nights total **after** weekly/monthly discounts. `serviceCents` = guest fee.
9. **Preview banner** (`PreviewBanner.tsx`) shows until `STRIPE_SECRET_KEY` is a live key.
10. **Demo data in production.** `vercel-build` runs the seed with `KEYVAGA_DEMO=true` and the demo password is public. **Remove that from `package.json` before launch** and delete the demo accounts.

## 6. Tests

```bash
npm test                                                                  # unit (+ skips DB/Stripe suites)
TEST_DATABASE_URL=postgresql://…/keyvaga_test npm run test:db              # DB constraints & search
STRIPE_SECRET_KEY=sk_test_… TEST_DATABASE_URL=… npm run test:stripe       # whole money flow in Stripe test mode
npm run lint && npx tsc --noEmit && npm run build
```

At handover: **98 tests passing** (unit + DB + Stripe test mode), lint and types clean, production build OK. The test DB must be separate and disposable, because the suites wipe tables.

## 7. What's done

Spec phases (section 12 of the brief):

1. **Foundation:** design tokens, wordmark and logo, accounts with multiple roles, home page per the design.
2. **Listings and search:**
   - Owner listing editor with photos, a 20-second video tour, amenities, house rules and a cancellation policy.
   - Admin review queue.
   - Search with filters and sorting.
   - Stay page with gallery, availability calendar and price breakdown.
3. **Booking and payments:**
   - Instant booking, Stripe checkout, the 30% deposit then balance schedule, cancellations and refunds.
   - Owner payouts (Connect), daily cron and webhook.
4. **Portals:**
   - Owner overview with real numbers and "Needs attention", calendar with blocking, pricing (weekend, seasonal, weekly/monthly discounts), bookings, payouts and messages.
   - Guest trips with check-in details released before arrival, house-rules agreement and digital guidebook.
   - Reviews (average shown on the stay page), Book again, Saved stays, profile and password change.

## 8. What's next

**Gaps inside phases 1–4 (smaller):**
- Map search (needs a Mapbox or similar account).
- Password reset and email verification (needs an email provider).
- Rate limiting on login and sign-up.
- Guest ID verification (Stripe Identity is a natural fit) and "Add to your stay" extras (early check-in, local experiences) from the guest design.
- A pay-with-new-card flow when the automatic balance charge fails (currently 3 automatic attempts, then a warning).
- Owners responding to reviews; becoming an owner from an existing guest account (today owners sign up with "List my property").
- Help center, Terms, Privacy and Cancellation policy pages (linked from checkout copy but not built).

**Phase 5, service portal** (spec §7): provider profiles, categories, quote requests and "post a job", quotes, accept, job tracking, payment and reviews. The owner-only entry point is `/owner/services` (the founder wants services visible to owners only; `/services` redirects there). The provider portal placeholder is `/provider`, and providers join via `/signup?intent=PROVIDER` (linked from the home page and footer). "Book a cleaner" links already pass `need`, `listing` and `date` query params to `/owner/services`.

**Phase 6, connections** (spec §10, §10a): iCal import and export first (`CalendarBlock.source` already has `ICAL` and `HOSPITABLE`), then Hospitable, PriceLabs (Dynamic Pricing API, needs certification) and smart locks (Seam or RemoteLock), plus the Connections page.

**Phase 7, polish and launch:**
- Email and SMS notifications: booking confirmation, owner "new booking", balance reminders, messages.
- Admin tools: disputes, refunds, reports, audit log.
- Security headers / CSP, monitoring.
- Accessibility audit.
- The **developer review of payments, security and privacy** required by the spec.
- Switching Stripe to live mode.

**Open business decisions still listed in the spec:** launch region, how service providers are vetted, final accent color, calendar source of truth, lock brands, and when door codes are released.
