-- Link listings to Hospitable properties; track which Keyvaga bookings were blocked in Hospitable.
ALTER TABLE "Listing"
  ADD COLUMN "hospitablePropertyId" TEXT,
  ADD COLUMN "hospitableSyncedAt" TIMESTAMP(3),
  ADD COLUMN "hospitableSyncError" TEXT;
CREATE UNIQUE INDEX "Listing_hospitablePropertyId_key" ON "Listing"("hospitablePropertyId");

ALTER TABLE "Booking" ADD COLUMN "hospitableBlockedAt" TIMESTAMP(3);
