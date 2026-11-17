-- Hide the three demo listings (Lakeside Cabin, Downtown Loft, Beach House) owned by the seeded
-- demo owner account. Paused, not deleted, so they can be restored for testing; delete before launch.
-- The demo seed no longer runs on deploy (removed from vercel-build), so they stay hidden.
UPDATE "Listing"
SET "status" = 'PAUSED'
WHERE "slug" IN ('lakeside-cabin', 'downtown-loft', 'beach-house')
  AND "ownerId" IN (SELECT "id" FROM "User" WHERE "email" = 'owner@keyvaga.test');
