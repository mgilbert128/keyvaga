-- Monthly owner fees (smart locks), collected from payouts.
CREATE TYPE "OwnerFeeStatus" AS ENUM ('OWED', 'COLLECTED', 'WAIVED');
CREATE TABLE "OwnerFee" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "OwnerFeeStatus" NOT NULL DEFAULT 'OWED',
    "collectedFromBookingId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerFee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OwnerFee_ownerId_kind_period_key" ON "OwnerFee"("ownerId", "kind", "period");
CREATE INDEX "OwnerFee_ownerId_status_idx" ON "OwnerFee"("ownerId", "status");
ALTER TABLE "OwnerFee" ADD CONSTRAINT "OwnerFee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "feesDeductedCents" INTEGER NOT NULL DEFAULT 0;
