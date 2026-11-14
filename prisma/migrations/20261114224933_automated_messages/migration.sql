-- CreateEnum
CREATE TYPE "MessageTrigger" AS ENUM ('BOOKING_CONFIRMED', 'BEFORE_CHECKIN', 'CHECKIN_DAY', 'BEFORE_CHECKOUT', 'AFTER_CHECKOUT');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "automated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "listingId" TEXT,
    "name" TEXT NOT NULL,
    "trigger" "MessageTrigger" NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoMessageLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "messageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageTemplate_ownerId_idx" ON "MessageTemplate"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoMessageLog_bookingId_templateId_key" ON "AutoMessageLog"("bookingId", "templateId");

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoMessageLog" ADD CONSTRAINT "AutoMessageLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoMessageLog" ADD CONSTRAINT "AutoMessageLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sanity checks (hand-written)
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_offset_range" CHECK ("offsetDays" BETWEEN 0 AND 60);
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_body_length" CHECK (char_length("body") BETWEEN 1 AND 4000);
