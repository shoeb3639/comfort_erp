ALTER TABLE "bookings"
  RENAME COLUMN "pickup_location" TO "pickup_reporting_address";

ALTER TABLE "bookings"
  RENAME COLUMN "drop_location" TO "travelling_to";

ALTER TABLE "bookings"
  ADD COLUMN "travelling_from" VARCHAR(500);
