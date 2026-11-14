-- CreateTable
CREATE TABLE "DateRate" (
    "listingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateRate_pkey" PRIMARY KEY ("listingId","date")
);

-- AddForeignKey
ALTER TABLE "DateRate" ADD CONSTRAINT "DateRate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sanity check (hand-written)
ALTER TABLE "DateRate" ADD CONSTRAINT "DateRate_rate_positive" CHECK ("rateCents" > 0);
