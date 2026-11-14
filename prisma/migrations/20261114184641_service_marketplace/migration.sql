-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PAUSED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'COMPLETED', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "JobPaymentKind" AS ENUM ('CHARGE', 'REFUND', 'PAYOUT');

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceAreaText" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "pricingGuidance" TEXT NOT NULL DEFAULT '',
    "availabilityNote" TEXT NOT NULL DEFAULT '',
    "status" "ProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderPhoto" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bookingId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferredDate" DATE,
    "flexibleDate" BOOLEAN NOT NULL DEFAULT true,
    "targetProviderId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "acceptedQuoteId" TEXT,
    "scheduledDate" DATE,
    "quoteCents" INTEGER NOT NULL DEFAULT 0,
    "ownerFeeCents" INTEGER NOT NULL DEFAULT 0,
    "ownerTotalCents" INTEGER NOT NULL DEFAULT 0,
    "providerFeeCents" INTEGER NOT NULL DEFAULT 0,
    "providerPayoutCents" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "releaseAfter" TIMESTAMP(3),
    "paidOutAt" TIMESTAMP(3),
    "disputeNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "ownerLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "proposedDate" DATE,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "QuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobReview" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPayment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "JobPaymentKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripeId" TEXT,
    "stripeChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_slug_key" ON "ProviderProfile"("slug");

-- CreateIndex
CREATE INDEX "ProviderProfile_status_region_idx" ON "ProviderProfile"("status", "region");

-- CreateIndex
CREATE INDEX "ProviderPhoto_providerId_position_idx" ON "ProviderPhoto"("providerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Job_acceptedQuoteId_key" ON "Job"("acceptedQuoteId");

-- CreateIndex
CREATE INDEX "Job_status_category_idx" ON "Job"("status", "category");

-- CreateIndex
CREATE INDEX "Job_ownerId_idx" ON "Job"("ownerId");

-- CreateIndex
CREATE INDEX "Quote_providerId_status_idx" ON "Quote"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_jobId_providerId_key" ON "Quote"("jobId", "providerId");

-- CreateIndex
CREATE INDEX "JobMessage_jobId_providerId_createdAt_idx" ON "JobMessage"("jobId", "providerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobReview_jobId_reviewerId_key" ON "JobReview"("jobId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPayment_stripeId_key" ON "JobPayment"("stripeId");

-- CreateIndex
CREATE INDEX "JobPayment_jobId_idx" ON "JobPayment"("jobId");

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderPhoto" ADD CONSTRAINT "ProviderPhoto_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_targetProviderId_fkey" FOREIGN KEY ("targetProviderId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_acceptedQuoteId_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPayment" ADD CONSTRAINT "JobPayment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Sanity checks (hand-written)
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_money_nonnegative" CHECK (
  "quoteCents" >= 0 AND "ownerFeeCents" >= 0 AND "ownerTotalCents" >= 0 AND "providerFeeCents" >= 0 AND "providerPayoutCents" >= 0
);
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_body_length" CHECK (char_length("body") BETWEEN 1 AND 4000);
ALTER TABLE "JobPayment" ADD CONSTRAINT "JobPayment_amount_positive" CHECK ("amountCents" > 0);
