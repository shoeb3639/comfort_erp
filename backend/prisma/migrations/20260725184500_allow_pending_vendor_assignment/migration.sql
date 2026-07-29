ALTER TABLE "bookings" DROP CONSTRAINT "bookings_assignment_check";
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_assignment_check" CHECK (
    ("assignment_source" = 'OWN' AND "vendor_id" IS NULL)
    OR (
      "assignment_source" = 'VENDOR'
      AND (
        (
          "vendor_id" IS NULL
          AND "vehicle_id" IS NULL
          AND "driver_id" IS NULL
        )
        OR "vendor_id" IS NOT NULL
      )
    )
  );
