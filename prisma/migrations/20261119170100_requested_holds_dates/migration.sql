-- A pending request holds its dates, like a checkout hold (separate migration: a new enum
-- value can't be used in the same transaction that adds it).
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_no_overlap";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
    EXCLUDE USING gist (
      "listingId" WITH =,
      daterange("checkIn", "checkOut", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'REQUESTED'));
