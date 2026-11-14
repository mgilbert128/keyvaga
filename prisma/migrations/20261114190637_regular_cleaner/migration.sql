-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "autoRequestCleaning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regularCleanerId" TEXT;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_regularCleanerId_fkey" FOREIGN KEY ("regularCleanerId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

