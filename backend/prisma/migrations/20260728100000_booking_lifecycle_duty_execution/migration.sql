ALTER TABLE "bookings"
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(6),
  ADD COLUMN "assigned_at" TIMESTAMPTZ(6),
  ADD COLUMN "duty_started_at" TIMESTAMPTZ(6),
  ADD COLUMN "duty_completed_at" TIMESTAMPTZ(6),
  ADD COLUMN "opening_odometer" DECIMAL(12, 2),
  ADD COLUMN "closing_odometer" DECIMAL(12, 2),
  ADD COLUMN "duty_start_remarks" TEXT,
  ADD COLUMN "duty_completion_remarks" TEXT,
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_reason" TEXT;

UPDATE "bookings"
SET "confirmed_at" = COALESCE("created_at", CURRENT_TIMESTAMP)
WHERE "status" IN ('CONFIRMED', 'ASSIGNED', 'RUNNING', 'COMPLETED', 'CLOSED');

UPDATE "bookings"
SET "assigned_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "status" IN ('ASSIGNED', 'RUNNING', 'COMPLETED', 'CLOSED');

UPDATE "bookings"
SET "duty_started_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "status" IN ('RUNNING', 'COMPLETED', 'CLOSED');

UPDATE "bookings"
SET "duty_completed_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "status" IN ('COMPLETED', 'CLOSED');

UPDATE "bookings"
SET
  "cancelled_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP),
  "cancellation_reason" = COALESCE("cancellation_reason", 'Legacy Cancellation')
WHERE "status" = 'CANCELLED';

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_odometer_check" CHECK (
    "opening_odometer" IS NULL
    OR "closing_odometer" IS NULL
    OR "closing_odometer" >= "opening_odometer"
  );
