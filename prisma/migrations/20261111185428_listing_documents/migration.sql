-- CreateEnum
CREATE TYPE "HostingRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OWNERSHIP_PROOF', 'RENTAL_PERMIT', 'MANAGEMENT_LICENSE', 'MANAGEMENT_AGREEMENT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ListingDocument" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATE,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "uploadedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingDocument_listingId_type_idx" ON "ListingDocument"("listingId", "type");

-- CreateIndex
CREATE INDEX "ListingDocument_status_idx" ON "ListingDocument"("status");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_listingId_createdAt_idx" ON "DocumentAccessLog"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingDocument" ADD CONSTRAINT "ListingDocument_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ListingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Sanity checks (hand-written)
ALTER TABLE "ListingDocument" ADD CONSTRAINT "ListingDocument_size_valid" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760);
