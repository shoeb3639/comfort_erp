-- Normalize existing configured prefixes before enforcing the new width.
UPDATE "tenants"
SET "invoice_prefix" = UPPER(LEFT(TRIM("invoice_prefix"), 3))
WHERE "invoice_prefix" IS NOT NULL;

UPDATE "invoices"
SET "invoice_prefix" = UPPER(LEFT(TRIM("invoice_prefix"), 3))
WHERE "invoice_prefix" IS NOT NULL;

ALTER TABLE "tenants" ALTER COLUMN "invoice_prefix" TYPE VARCHAR(3);
ALTER TABLE "invoices" ALTER COLUMN "invoice_prefix" TYPE VARCHAR(3);

DROP INDEX "invoices_tenant_sequence_key";
CREATE UNIQUE INDEX "invoices_tenant_fy_prefix_sequence_key"
ON "invoices"("tenant_id", "financial_year", "invoice_prefix", "invoice_sequence");

CREATE TABLE "invoice_sequences" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "financial_year" VARCHAR(20) NOT NULL,
  "invoice_prefix" VARCHAR(3) NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_sequences_tenant_fy_prefix_key"
ON "invoice_sequences"("tenant_id", "financial_year", "invoice_prefix");
CREATE INDEX "invoice_sequences_tenant_fy_idx"
ON "invoice_sequences"("tenant_id", "financial_year");
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Establish counters above every sequence already consumed before this table existed.
-- Runtime allocation never derives a number from invoice rows.
INSERT INTO "invoice_sequences" (
  "id",
  "tenant_id",
  "financial_year",
  "invoice_prefix",
  "last_number",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  "tenant_id",
  "financial_year",
  "invoice_prefix",
  MAX("invoice_sequence"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invoices"
WHERE "financial_year" IS NOT NULL
  AND "invoice_prefix" IS NOT NULL
  AND "invoice_sequence" IS NOT NULL
GROUP BY "tenant_id", "financial_year", "invoice_prefix";
