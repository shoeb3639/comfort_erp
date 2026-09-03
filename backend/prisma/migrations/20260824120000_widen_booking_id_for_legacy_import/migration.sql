-- Legacy booking identifiers use historical formats up to 14 characters.
-- Widening is backward compatible with the current generated identifiers.
ALTER TABLE "bookings"
ALTER COLUMN "booking_id" TYPE VARCHAR(20);
