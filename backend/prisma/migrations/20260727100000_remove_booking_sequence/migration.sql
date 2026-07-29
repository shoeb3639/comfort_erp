ALTER TABLE "bookings"
  DROP CONSTRAINT "bookings_sequence_check";

DROP INDEX "bookings_sequence_key";

ALTER TABLE "bookings"
  DROP COLUMN "booking_sequence";
