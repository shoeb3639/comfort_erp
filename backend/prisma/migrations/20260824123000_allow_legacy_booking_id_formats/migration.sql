-- Preserve the generated PREFIX-NNNNNN format while admitting the three
-- historical Comfort Cars identifiers present in the checksum-locked source.
ALTER TABLE "bookings"
DROP CONSTRAINT "bookings_booking_id_format_check";

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_booking_id_format_check" CHECK (
  "booking_id" ~ '^[A-Z0-9]{4}-[0-9]{6}$'
  OR "booking_id" ~ '^CMF[0-9]{2}-([0-9]{5,6}|[0-9]{4}-[0-9]{3})$'
);
