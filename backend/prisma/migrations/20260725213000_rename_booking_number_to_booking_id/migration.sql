ALTER TABLE "bookings"
  RENAME COLUMN "booking_number" TO "booking_id";

ALTER TABLE "bookings"
  RENAME CONSTRAINT "bookings_number_format_check"
  TO "bookings_booking_id_format_check";

ALTER INDEX "bookings_number_key"
  RENAME TO "bookings_booking_id_key";
