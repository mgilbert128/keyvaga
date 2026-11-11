-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "hostingRole" "HostingRole",
ADD COLUMN     "managerCompany" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "permitNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "permitRequired" BOOLEAN NOT NULL DEFAULT false;

