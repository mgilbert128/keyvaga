-- CreateEnum
CREATE TYPE "AccessCodeStatus" AS ENUM ('SETTING', 'SET', 'FAILED', 'REMOVED');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Chicago';

-- CreateTable
CREATE TABLE "LockAccount" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "seamAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LockAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lock" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lockAccountId" TEXT NOT NULL,
    "seamDeviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "listingId" TEXT,
    "backupCode" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "bookingId" TEXT,
    "jobId" TEXT,
    "seamCodeId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AccessCodeStatus" NOT NULL DEFAULT 'SETTING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockEvent" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lockId" TEXT,
    "bookingId" TEXT,
    "jobId" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockConnectSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LockConnectSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LockAccount_seamAccountId_key" ON "LockAccount"("seamAccountId");

-- CreateIndex
CREATE INDEX "LockAccount_ownerId_idx" ON "LockAccount"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Lock_seamDeviceId_key" ON "Lock"("seamDeviceId");

-- CreateIndex
CREATE INDEX "Lock_listingId_idx" ON "Lock"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_seamCodeId_key" ON "AccessCode"("seamCodeId");

-- CreateIndex
CREATE INDEX "AccessCode_bookingId_idx" ON "AccessCode"("bookingId");

-- CreateIndex
CREATE INDEX "AccessCode_jobId_idx" ON "AccessCode"("jobId");

-- CreateIndex
CREATE INDEX "AccessCode_lockId_startsAt_idx" ON "AccessCode"("lockId", "startsAt");

-- CreateIndex
CREATE INDEX "LockEvent_ownerId_createdAt_idx" ON "LockEvent"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "LockAccount" ADD CONSTRAINT "LockAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_lockAccountId_fkey" FOREIGN KEY ("lockAccountId") REFERENCES "LockAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_lockId_fkey" FOREIGN KEY ("lockId") REFERENCES "Lock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockEvent" ADD CONSTRAINT "LockEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockEvent" ADD CONSTRAINT "LockEvent_lockId_fkey" FOREIGN KEY ("lockId") REFERENCES "Lock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

