-- Verified ratings from other sites (shown separately from Keyvaga reviews).
CREATE TYPE "ExternalRatingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "ExternalRating" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "status" "ExternalRatingStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalRating_listingId_platform_key" ON "ExternalRating"("listingId", "platform");
CREATE INDEX "ExternalRating_status_idx" ON "ExternalRating"("status");
ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
