-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');

-- CreateEnum
CREATE TYPE "BalanceStatus" AS ENUM ('NONE', 'SCHEDULED', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_DUE', 'PENDING', 'PAID', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'REFUND', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "balanceAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceDueDate" DATE,
ADD COLUMN     "balanceStatus" "BalanceStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "dueNowCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "hostFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hostPayoutCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payoutDueCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NOT_DUE',
ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripePaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripeId" TEXT,
    "stripeChargeId" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeId_key" ON "Payment"("stripeId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_status_balanceDueDate_idx" ON "Booking"("status", "balanceDueDate");

-- CreateIndex
CREATE INDEX "Booking_payoutStatus_checkIn_idx" ON "Booking"("payoutStatus", "checkIn");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Money sanity checks (hand-written)
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_money_nonnegative" CHECK (
    "nightlyCents" >= 0 AND "cleaningCents" >= 0 AND "serviceCents" >= 0 AND "totalCents" >= 0
    AND "hostFeeCents" >= 0 AND "hostPayoutCents" >= 0 AND "dueNowCents" >= 0 AND "balanceCents" >= 0
    AND "refundedCents" >= 0 AND "payoutDueCents" >= 0
  ),
  ADD CONSTRAINT "Booking_schedule_adds_up" CHECK ("dueNowCents" + "balanceCents" = "totalCents"),
  ADD CONSTRAINT "Booking_refund_within_total" CHECK ("refundedCents" <= "totalCents");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountCents" > 0);
