-- Sleeping arrangements per listing (rooms and their beds).
ALTER TABLE "Listing" ADD COLUMN "sleeping" JSONB NOT NULL DEFAULT '[]';
