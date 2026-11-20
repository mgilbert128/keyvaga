-- Security deposits: held on the guest's card from check-in day, released or charged after checkout.
ALTER TABLE "Listing" ADD COLUMN "securityDepositCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "securityDepositCents" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'FAILED', 'RELEASED', 'CHARGED');

CREATE TABLE "DepositHold" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "DepositStatus" NOT NULL,
    "stripePaymentIntentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "releaseBy" TIMESTAMP(3) NOT NULL,
    "renewals" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "chargedCents" INTEGER NOT NULL DEFAULT 0,
    "chargeReason" TEXT,
    "stripeTransferId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DepositHold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DepositHold_bookingId_key" ON "DepositHold"("bookingId");
CREATE INDEX "DepositHold_status_expiresAt_idx" ON "DepositHold"("status", "expiresAt");
ALTER TABLE "DepositHold" ADD CONSTRAINT "DepositHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
