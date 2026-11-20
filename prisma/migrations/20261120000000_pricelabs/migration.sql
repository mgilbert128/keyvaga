-- PriceLabs: owners connect their own PriceLabs account (Customer API key, stored encrypted) and link listings.
ALTER TABLE "Listing" ADD COLUMN "pricelabsListingId" TEXT,
ADD COLUMN "pricelabsPms" TEXT,
ADD COLUMN "pricelabsSyncedAt" TIMESTAMP(3),
ADD COLUMN "pricelabsSyncError" TEXT;

CREATE TABLE "PriceLabsConnection" (
    "ownerId" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceLabsConnection_pkey" PRIMARY KEY ("ownerId")
);

ALTER TABLE "PriceLabsConnection" ADD CONSTRAINT "PriceLabsConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
