# Keyvaga

*Your key to the ultimate vacation getaway.*

A vacation rental marketplace with three portals behind one login: guests book stays, owners run rentals, and service providers (cleaners, handymen and similar) take jobs from owners.

## Status: Phase 1 (Foundation)

Done:
- Next.js app with design tokens (all colors in `src/app/globals.css`)
- Accounts and roles: sign up, log in and log out, with one person able to hold several roles
- Role-protected portals: `/trips` (guest), `/owner`, `/provider`, `/admin`
- Public pages: home, search, listing detail, list your property, services
- Database rule that blocks double-bookings
- Tests for permissions, auth and the overlap rule

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

Vercel runs `npm run vercel-build`, which applies database migrations, loads the sample data (`KEYVAGA_DEMO=true`) and builds the site. The sample accounts are public on the preview, so **remove `KEYVAGA_DEMO=true prisma db seed` from `vercel-build` before real launch.**

## Tests

```bash
npm test                                                             # unit tests
TEST_DATABASE_URL=postgresql://.../keyvaga_test npm run test:db      # database rules (use a separate, empty database)
```

## How permissions work

- `src/proxy.ts` sends visitors without a session cookie to the login page (a fast first check only).
- `src/lib/auth/dal.ts` is the real gate: every protected page calls `requirePortal(...)`, which checks the session in the database and the user's role.
- Admin is never self-assigned at sign-up.

## How double-booking is prevented

The `Booking` table has a Postgres exclusion constraint (`prisma/migrations/*_init/migration.sql`): two pending or confirmed bookings for the same listing can't have overlapping `[checkIn, checkOut)` ranges. Check-out day can be the next guest's check-in day. The database enforces this even if two people book at the same moment.

## Build phases

1. **Foundation** ✅
2. Listings and search (owner listing creation, full search with filters and map, listing detail)
3. Booking and payments (checkout, Stripe Connect, confirmation, payouts)
4. Guest portal, then owner portal
5. Service portal
6. Connections (iCal, Hospitable, PriceLabs, door locks)
7. Polish and launch (notifications, admin tools, security review)
