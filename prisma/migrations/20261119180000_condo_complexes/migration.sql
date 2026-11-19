-- Condo complexes: buildings/resorts that group several listings.
CREATE TABLE "Complex" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Complex_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Complex_slug_key" ON "Complex"("slug");
CREATE INDEX "Complex_city_region_idx" ON "Complex"("city", "region");

ALTER TABLE "Listing" ADD COLUMN "complexId" TEXT;
CREATE INDEX "Listing_complexId_idx" ON "Listing"("complexId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex"("id") ON DELETE SET NULL ON UPDATE CASCADE;
