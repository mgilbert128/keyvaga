-- Owner date-range discounts (percent off the nightly price).
CREATE TABLE "DateDiscount" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DateDiscount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DateDiscount_percent_check" CHECK ("percentBps" > 0 AND "percentBps" <= 9000),
    CONSTRAINT "DateDiscount_dates_check" CHECK ("endDate" > "startDate")
);
CREATE INDEX "DateDiscount_listingId_endDate_idx" ON "DateDiscount"("listingId", "endDate");
ALTER TABLE "DateDiscount" ADD CONSTRAINT "DateDiscount_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
