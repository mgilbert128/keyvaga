-- Optional pet fee: set per listing, charged per stay only when the guest brings a pet.
ALTER TABLE "Listing" ADD COLUMN "petFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "pets" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "petFeeCents" INTEGER NOT NULL DEFAULT 0;
