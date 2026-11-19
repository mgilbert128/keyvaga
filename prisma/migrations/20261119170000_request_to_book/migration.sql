-- Request to book: a new booking status and a flag on the booking.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TABLE "Booking" ADD COLUMN "isRequest" BOOLEAN NOT NULL DEFAULT false;

