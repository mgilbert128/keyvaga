# Keyvaga

*Your key to the ultimate vacation getaway.*

A vacation rental marketplace with three portals behind one login: guests book stays, owners run rentals, and service providers (cleaners, handymen and similar) take jobs from owners.

## Status: Phases 1–4 done. See HANDOVER.md before making changes

Done:
- Next.js app with design tokens (all colors in `src/app/globals.css`)
- Accounts and roles: sign up, log in and log out, with one person able to hold several roles
- Role-protected portals: `/trips` (guest), `/owner`, `/provider`, `/admin`
- Public pages: home, search, listing detail, list your property, services
- Database rule that blocks double-bookings
- Tests for permissions, auth and the overlap rule

Phase 2 adds:
- Owners create, edit, save as draft, submit, pause and unpause listings, with photo uploads and one optional video tour of up to 20 seconds (Vercel Blob; videos upload straight from the browser)
- Admin review queue: approve and publish, or request changes with a note
- Search filters (price, bedrooms, property type, amenities) and sorting
- Stay page with photo gallery, amenities, house rules, availability calendar and price breakdown
- The exact address stays private until booking

Phase 3 adds:
- Instant booking with a 15-minute date hold while the guest pays (Stripe Payment Element; card numbers never touch Keyvaga)
- Fees: 10% total, 5% guest service fee + 5% host fee (`src/lib/booking-money.ts`)
- Payment plan: 30% at booking, balance charged automatically to the saved card 30 days before check-in (full payment when booking within 30 days)
- Cancellation policies per listing: Flexible, Moderate, Strict; refunds computed from what the guest has paid, owner cancellations refund in full
- Owner payouts with Stripe Connect Express, transferred after check-in (separate charges and transfers)
- Daily job (`/api/cron/daily`, scheduled in `vercel.json`): releases expired holds, charges balances, sends payouts
- Stripe webhook (`/api/stripe/webhook`) keeps payments and payout-account status in sync
- Guest trips pages, owner bookings and payouts pages

Phase 4 adds:
- Owner overview with real numbers and "Needs attention", calendar with date blocking, pricing (weekend rate, seasonal rates, weekly/monthly discounts), messages per booking
- Guest trips with check-in details released before arrival, house-rules agreement, digital guidebook, reviews, Book again, Saved stays, profile and password change

Decided: guests **book instantly**; currency is **USD** (stored as whole cents).

## Tech stack

| Area | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS 4, design tokens in CSS variables |
| Database | PostgreSQL + Prisma 7 |
| Auth | Server-side sessions (hashed tokens in Postgres, httpOnly cookie), bcrypt passwords |
| Tests | Vitest |

Planned for later phases: Stripe Connect (payments), Mapbox (maps), Resend and Twilio (email and SMS), Cloudflare R2 (photos), Inngest (background jobs), hosting on Vercel.

## Running it locally

You need Node 22+ and PostgreSQL 16.

```bash
cp .env.example .env              # then set DATABASE_URL
npm install
npx prisma migrate dev            # create tables
npm run db:seed                   # sample users and listings
npm run dev                       # http://localhost:3000
```

Sample accounts (password `keyvaga-demo-123`): `guest@keyvaga.test`, `owner@keyvaga.test`, `provider@keyvaga.test`, `admin@keyvaga.test`.

## Preview site (Vercel + Neon)

Environment variables on Vercel:
- `DATABASE_URL` / `POSTGRES_*`: set automatically by the Neon integration
- `BLOB_STORE_ID` (or `BLOB_READ_WRITE_TOKEN` on older stores): set automatically when a Vercel Blob store is connected (photo uploads)
- `ADMIN_EMAILS`: emails that get the admin role
- `STRIPE_SECRET_KEY`: Stripe secret key (`sk_test_…` while testing)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (`pk_test_…`)
- `STRIPE_WEBHOOK_SECRET`: signing secret (`whsec_…`) of the webhook endpoint `https://<site>/api/stripe/webhook` with events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated`
- `CRON_SECRET`: any long random string; Vercel sends it to the daily job

Vercel runs `npm run vercel-build`, which applies database migrations, loads the sample data (`KEYVAGA_DEMO=true`) and builds the site. The sample accounts are public on the preview, so **remove `KEYVAGA_DEMO=true prisma db seed` from `vercel-build` before real launch.**

## Tests

```bash
npm test                                                             # unit tests
TEST_DATABASE_URL=postgresql://.../keyvaga_test npm run test:db      # database rules (use a separate, empty database)
STRIPE_SECRET_KEY=sk_test_... TEST_DATABASE_URL=... npm run test:stripe   # full booking money flow in Stripe TEST mode
```

## How permissions work

- `src/proxy.ts` sends visitors without a session cookie to the login page (a fast first check only).
- `src/lib/auth/dal.ts` is the real gate: every protected page calls `requirePortal(...)`, which checks the session in the database and the user's role.
- Admin is never self-assigned at sign-up. Set `ADMIN_EMAILS` (comma-separated) in the environment; those accounts get the admin role at their next login.
- Owners can only see and change their own listings (`src/lib/listing-policy.ts`, `src/lib/owner-listings.ts`).

## How double-booking is prevented

The `Booking` table has a Postgres exclusion constraint (`prisma/migrations/*_init/migration.sql`): two pending or confirmed bookings for the same listing can't have overlapping `[checkIn, checkOut)` ranges. Check-out day can be the next guest's check-in day. The database enforces this even if two people book at the same moment.

## Build phases

1. **Foundation** ✅
2. Listings and search ✅ (map still to do: needs a Mapbox account)
3. Booking and payments ✅
4. Guest portal, then owner portal ✅
5. Service portal
6. Connections (iCal, Hospitable, PriceLabs, door locks)
7. Polish and launch (notifications, admin tools, security review)
