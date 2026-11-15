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
| `RESEND_API_KEY`, `EMAIL_FROM` | Manual | Email via Resend. keyvaga.com is verified; `EMAIL_FROM=Keyvaga <hello@keyvaga.com>`. |
| `SEAM_API_KEY` | Manual | Smart locks via Seam. Sandbox keys (`seam_test…`) give virtual locks; use a production workspace key at launch. Without it the Smart locks tab says "Coming soon". |
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
    services.ts            service marketplace rules: categories, job fees (5% + 5%), area matching, job lifecycle (pure)
    jobs.ts                service job engine: create, quote, accept+pay, complete, release/auto-release, problems, refunds, payouts, turnover automation
    providers.ts           provider profiles, ratings/response time, directory search
    auto-messages.ts       automated guest message rules: triggers, send days, catch-up window, fill-ins, suggested templates (pure)
    email.ts / email-templates.ts  Resend REST sender + escaped branded layout; notify.ts = all notification emails (best-effort, never throw)
    auto-messages-server.ts sends due automated messages (on booking confirmation + daily cron), deduped by AutoMessageLog
    pricing.ts             nightly rates (custom date price > season > weekend > base), weekly/monthly discounts (pure)
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
- **Proof of ownership.** `src/lib/documents.ts` (rules) plus `ListingDocument` and `DocumentAccessLog`. Guests see "Verified owner/manager" and "Permit verified" badges (`listingVerification`) computed live from approved, in-date documents.
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
10. **Redirects match case-insensitively.** Never add a `next.config.ts` redirect whose source differs from its destination only by case (`/Login` → `/login` looped forever and broke login). `tests/unit/redirects.test.ts` guards this.
11. **Demo data in production.** `vercel-build` runs the seed with `KEYVAGA_DEMO=true` and the demo password is public. **Remove that from `package.json` before launch** and delete the demo accounts.

## 6. Tests

```bash
npm test                                                                  # unit (+ skips DB/Stripe suites)
TEST_DATABASE_URL=postgresql://…/keyvaga_test npm run test:db              # DB constraints & search
STRIPE_SECRET_KEY=sk_test_… TEST_DATABASE_URL=… npm run test:stripe       # whole money flow in Stripe test mode
SEAM_INTEGRATION=1 SEAM_API_KEY=seam_test… SEAM_TEST_ACCOUNT=<id> npx vitest run tests/seam   # real Seam sandbox
npm run lint && npx tsc --noEmit && npm run build
```

At handover: **118 tests passing** (unit + DB + Stripe test mode), lint and types clean, production build OK. The test DB must be separate and disposable, because the suites wipe tables.

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
   - Owner overview with real numbers and "Needs attention", calendar with tap-to-select dates to set custom prices (e.g. a holiday weekend), block or reset; pricing (weekend, seasonal, weekly/monthly discounts), bookings, payouts and messages.
   - Guest trips with check-in details released before arrival, house-rules agreement and digital guidebook.
   - Reviews (average shown on the stay page), Book again, Saved stays, profile and password change.
5. **Service portal:**
   - **Providers (`/provider`):** business profile (services, towns served, state, photos, pricing guidance, availability) that goes live after admin approval; job inbox (direct requests + open jobs matching their area and category); quote builder; mark done; payouts via Stripe Connect; reviews.
   - **Owners (owner-only, `/owner/services`, `/owner/jobs`):** directory filtered by category and by the property's city, or any state/city where providers work; provider cards and profiles; request a quote or post a job; compare and accept quotes; pay; message providers; release payment or report a problem; reviews.
   - **Money:** the owner pays quote + 5% when accepting. Keyvaga holds the funds (separate charges and transfers) and transfers quote − 5% to the provider when the owner releases, or automatically 3 days after the provider marks the job done (daily cron). Owner or provider cancellation refunds in full. Reported problems go to `/admin/problems` (pay the provider or refund).
   - **Turnover cleaning:** owners set a regular cleaner per listing. With "automatically request" on, a confirmed booking creates a direct cleaning request for checkout day (`autoRequestTurnover`), and a cancelled booking cancels and refunds its cleaning (`cancelJobsForBooking`). "Book a cleaner" on bookings and in Needs attention pre-fills the request.
   - **Admin:** `/admin/providers` (approval queue plus providers by state → city coverage) and `/admin/problems`.
   - **Fees** for service jobs were an open decision in the spec; they're set to 5% + 5% in `src/lib/services.ts` (`JOB_OWNER_FEE_BPS`, `JOB_PROVIDER_FEE_BPS`).

6. **Automated guest messages:** owners create message templates (Messages → Automated messages) sent on booking confirmation, X days before check-in, on check-in day, X days before checkout or X days after checkout, for all listings or one, with fill-ins such as `{guest_first_name}`, `{check_in_date}`, `{address}` and `{checkin_instructions}`. Suggested set of five, live preview, on/off. Delivered into the booking's message thread (marked Automated). Confirmation messages send instantly; scheduled ones go out with the daily cron (Vercel Hobby runs crons once a day; move to hourly on Pro for time-of-day sending). Late bookings catch up on missed pre-arrival messages. Automated messages are also emailed to the guest.
7. **Email (Resend):** booking confirmed (guest + owner), booking cancelled (both, with refund), new message alerts (booking and service-job threads), automated messages, service jobs (new request to providers, quote received, hired, job done), and **Forgot password** (`/forgot-password`, one-time hashed tokens valid 1 hour, max 3/hour, signs out all devices; identical answer whether or not the account exists). Env: `RESEND_API_KEY`, `EMAIL_FROM`, optional `NEXT_PUBLIC_SITE_URL`. **A sending domain must be verified in Resend** before emails reach anyone other than the Resend account owner. Booking confirmation is now idempotent (conditional update), so emails and follow-ups run once even when the return page and webhook race. SMS is not built.
8. **Smart locks (Seam):** Owner → Smart locks. Owners connect a lock-brand account through a Seam Connect Webview (`startConnect` / `finishPendingConnects` in `src/lib/locks/index.ts`; pending flows are stored in `LockConnectSession` and finished when the owner lands back on the page), assign each lock to a listing, set an optional backup code and the listing's time zone (`Listing.timeZone`). Confirmed bookings get one 6-digit code on every lock of the listing, valid check-in time → checkout time in local time (`src/lib/locks/time.ts`); if a lock rejects our code, the lock picks one. Hired jobs get a 7 AM–9 PM code on the job day. Codes are removed on cancel (booking or job) and when a job is marked complete. Guests see the code on the trip page once check-in details are released; providers on the job page; owners on the booking page. `{door_code}` fill-in for automated messages. Failures become `LockEvent`s with Retry under "Needs attention"; the backup code is shown to the guest meanwhile. The daily cron refreshes locks and fills in missing codes. Seam client: `src/lib/locks/seam.ts` (REST, swap in a fake with `setSeamClient` for tests). Sandbox login for testing the Connect flow: Schlage, `jane@example.com` / `1234`. Seam bills per connected device in production: decide who pays. Not built: Seam webhooks (we poll on page load and daily), changing a booking's dates updates codes (dates can't change today).
9. **Cleaning checklist with photo proof:** each listing has a turnover checklist and a required photo count (listing editor → Turnover cleaning; empty list = `DEFAULT_CHECKLIST` in `src/lib/checklist.ts`). Cleaning jobs snapshot the checklist into `JobChecklistItem` rows when created (open requests are refreshed when the owner edits the list). The hired cleaner ticks items and uploads photos (`POST /api/jobs/[id]/photos`, stored privately like verification documents, served by `/api/job-photos/[id]` only to the job owner, the hired provider and admins). `markComplete` refuses until every item is ticked and `Job.minPhotos` photos are in. Owners see the ticked list with times and the photos before releasing payment; admins see them on Reported problems. Jobs created before this feature have no checklist and aren't blocked.

## 8. What's next

**Gaps inside phases 1–4 (smaller):**
- Map search (needs a Mapbox or similar account).
- Password reset and email verification (needs an email provider).
- Rate limiting on login and sign-up.
- Guest ID verification (Stripe Identity is a natural fit) and "Add to your stay" extras (early check-in, local experiences) from the guest design.
- A pay-with-new-card flow when the automatic balance charge fails (currently 3 automatic attempts, then a warning).
- Owners responding to reviews; becoming an owner from an existing guest account (today owners sign up with "List my property").
- Help center, Terms, Privacy and Cancellation policy pages (linked from checkout copy but not built).

**Service portal follow-ups:** provider verification documents (license/insurance) reusing the listing-documents pattern; optional paid "featured" tier for providers; maintenance reports from cleaners that become handyman jobs; auto-accept at a regular cleaner's standing price.

**Phase 6, connections** (spec §10, §10a): iCal import and export first (`CalendarBlock.source` already has `ICAL` and `HOSPITABLE`), then Hospitable, PriceLabs (Dynamic Pricing API, needs certification). Smart locks are done (Seam).

**Phase 7, polish and launch:**
- Email and SMS notifications: booking confirmation, owner "new booking", balance reminders, messages.
- Admin tools: disputes, refunds, reports, audit log.
- Security headers / CSP, monitoring.
- Accessibility audit.
- The **developer review of payments, security and privacy** required by the spec.
- Switching Stripe to live mode.

**Open business decisions still listed in the spec:** launch region, how service providers are vetted, final accent color, calendar source of truth, lock brands, and when door codes are released.
