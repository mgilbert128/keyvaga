-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "minPhotos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "cleaningChecklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cleaningMinPhotos" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "JobChecklistItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "JobChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobChecklistItem_jobId_position_idx" ON "JobChecklistItem"("jobId", "position");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_createdAt_idx" ON "JobPhoto"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

