-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "videoAccess" TEXT,
ADD COLUMN     "videoContentType" TEXT,
ADD COLUMN     "videoDurationSec" DOUBLE PRECISION,
ADD COLUMN     "videoKey" TEXT,
ADD COLUMN     "videoUrl" TEXT;
