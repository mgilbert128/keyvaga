-- Owner-deleted listings that must be kept for booking records.
ALTER TABLE "Listing" ADD COLUMN "deletedAt" TIMESTAMP(3);
