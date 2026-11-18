-- Owner-initiated payment requests on bookings (parking passes, gear rentals, etc.).
CREATE TYPE "PaymentRequestStatus" AS ENUM ('REQUESTED', 'PAID', 'DECLINED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "keyvagaTaxCents" INTEGER NOT NULL DEFAULT 0,
    "ownerTaxCents" INTEGER NOT NULL DEFAULT 0,
    "taxLines" JSONB,
    "totalCents" INTEGER NOT NULL,
    "hostFeeCents" INTEGER NOT NULL,
    "ownerPayoutCents" INTEGER NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "paidAt" TIMESTAMP(3),
    "stripeTransferId" TEXT,
    "paidOutAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentRequest_amount_check" CHECK ("amountCents" >= 500 AND "amountCents" <= 500000 AND "totalCents" >= "amountCents")
);
CREATE UNIQUE INDEX "PaymentRequest_stripePaymentIntentId_key" ON "PaymentRequest"("stripePaymentIntentId");
CREATE INDEX "PaymentRequest_bookingId_idx" ON "PaymentRequest"("bookingId");
CREATE INDEX "PaymentRequest_status_paidOutAt_idx" ON "PaymentRequest"("status", "paidOutAt");
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
