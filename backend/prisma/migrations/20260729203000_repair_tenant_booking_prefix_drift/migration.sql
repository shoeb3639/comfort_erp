-- Forward-only repair for environments where the historical booking migration
-- was recorded before the tenant prefix column was added to that migration.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "booking_prefix" CHAR(4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_booking_prefix_format_check'
  ) THEN
    ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_booking_prefix_format_check"
      CHECK (
        "booking_prefix" IS NULL
        OR "booking_prefix" ~ '^[A-Z0-9]{4}$'
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_booking_prefix_key"
  ON "tenants"("booking_prefix");
