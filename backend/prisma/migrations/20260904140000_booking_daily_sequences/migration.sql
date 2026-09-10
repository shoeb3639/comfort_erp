-- Historical booking identifiers are intentionally retained unchanged.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "bookings"
    WHERE "booking_id" IS NOT NULL
    GROUP BY "tenant_id", "booking_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot scope booking numbers by tenant: same-tenant duplicates exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "bookings_booking_id_key";

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_booking_id_format_check";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_id_format_check" CHECK (
  "booking_id" IS NULL
  OR "booking_id" ~ '^[0-9]{2}-[0-9]{7,}$'
  OR "booking_id" ~ '^[A-Z0-9]{4}-[0-9]{6}$'
  OR "booking_id" ~ '^CMF[0-9]{2}-([0-9]{5,6}|[0-9]{4}-[0-9]{3})$'
);

ALTER TABLE "bookings"
  ALTER COLUMN "booking_id" DROP NOT NULL,
  ADD COLUMN "booking_sequence" INTEGER,
  ADD COLUMN "booking_number_date" DATE;

CREATE UNIQUE INDEX "bookings_tenant_booking_number_key"
  ON "bookings"("tenant_id", "booking_id");
CREATE UNIQUE INDEX "bookings_tenant_date_sequence_key"
  ON "bookings"("tenant_id", "booking_number_date", "booking_sequence");

CREATE TABLE "booking_sequences" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "booking_date" DATE NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_sequences_tenant_date_key"
  ON "booking_sequences"("tenant_id", "booking_date");
ALTER TABLE "booking_sequences" ADD CONSTRAINT "booking_sequences_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed only identifiers that unambiguously match YY-MMDDSSS and contain a
-- real calendar date. Legacy/prefixed identifiers are not guessed or changed.
INSERT INTO "booking_sequences" (
  "id", "tenant_id", "booking_date", "last_number", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  parsed."tenant_id",
  parsed."booking_date",
  MAX(parsed."sequence_number"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    "tenant_id",
    TO_DATE('20' || SUBSTRING("booking_id" FROM 1 FOR 2) || SUBSTRING("booking_id" FROM 4 FOR 4), 'YYYYMMDD') AS "booking_date",
    SUBSTRING("booking_id" FROM 8)::INTEGER AS "sequence_number",
    SUBSTRING("booking_id" FROM 1 FOR 2) || SUBSTRING("booking_id" FROM 4 FOR 4) AS "encoded_date"
  FROM "bookings"
  WHERE "booking_id" ~ '^[0-9]{2}-[0-9]{7,}$'
) AS parsed
WHERE TO_CHAR(parsed."booking_date", 'YYMMDD') = parsed."encoded_date"
GROUP BY parsed."tenant_id", parsed."booking_date";
