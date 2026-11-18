-- Owner waitlist during the soft launch.
CREATE TABLE "OwnerWaitlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "propertyCount" INTEGER NOT NULL DEFAULT 1,
    "locations" TEXT NOT NULL DEFAULT '',
    "software" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerWaitlist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OwnerWaitlist_createdAt_idx" ON "OwnerWaitlist"("createdAt");
CREATE INDEX "OwnerWaitlist_email_idx" ON "OwnerWaitlist"("email");
