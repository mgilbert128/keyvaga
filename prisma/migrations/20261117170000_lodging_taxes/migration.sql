-- Lodging taxes: admin-entered rates, and a tax snapshot on each booking.
CREATE TYPE "TaxFiler" AS ENUM ('KEYVAGA', 'OWNER');

CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "ratePpm" INTEGER NOT NULL,
    "filedBy" "TaxFiler" NOT NULL DEFAULT 'KEYVAGA',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TaxRate_ratePpm_range" CHECK ("ratePpm" >= 0 AND "ratePpm" <= 300000)
);
CREATE INDEX "TaxRate_state_active_idx" ON "TaxRate"("state", "active");

ALTER TABLE "Booking"
  ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "keyvagaTaxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ownerTaxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taxLines" JSONB,
  ADD COLUMN "taxRetainedCents" INTEGER;
