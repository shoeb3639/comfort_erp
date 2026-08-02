CREATE TYPE "FundReleaseStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE "company_fund_releases" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ledger_id" UUID NOT NULL,
  "release_date" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "payment_mode" "AccountPaymentMode" NOT NULL,
  "reference_number" VARCHAR(150) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "attachment_name" VARCHAR(255),
  "status" "FundReleaseStatus" NOT NULL DEFAULT 'PENDING',
  "released_by" UUID NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "verified_by" UUID,
  "verified_at" TIMESTAMPTZ(6),
  "ledger_entry_id" UUID,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "company_fund_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_fund_releases_positive_amount_check"
    CHECK ("amount" > 0),
  CONSTRAINT "company_fund_releases_posting_state_check"
    CHECK (
      (
        "status" = 'VERIFIED'
        AND "verified_by" IS NOT NULL
        AND "verified_at" IS NOT NULL
        AND "ledger_entry_id" IS NOT NULL
      )
      OR
      (
        "status" <> 'VERIFIED'
        AND "ledger_entry_id" IS NULL
      )
    )
);

CREATE UNIQUE INDEX "company_fund_releases_tenant_id_id_key"
  ON "company_fund_releases"("tenant_id", "id");
CREATE UNIQUE INDEX "company_fund_releases_tenant_reference_key"
  ON "company_fund_releases"("tenant_id", "reference_number");
CREATE UNIQUE INDEX "company_fund_releases_ledger_entry_key"
  ON "company_fund_releases"("ledger_entry_id");
CREATE INDEX "company_fund_releases_tenant_status_date_idx"
  ON "company_fund_releases"("tenant_id", "status", "release_date");
CREATE INDEX "company_fund_releases_tenant_ledger_date_idx"
  ON "company_fund_releases"("tenant_id", "ledger_id", "release_date");

ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_ledger_fkey"
  FOREIGN KEY ("tenant_id", "ledger_id")
  REFERENCES "manager_ledgers"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_released_by_fkey"
  FOREIGN KEY ("tenant_id", "released_by")
  REFERENCES "users"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_approved_by_fkey"
  FOREIGN KEY ("tenant_id", "approved_by")
  REFERENCES "users"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_verified_by_fkey"
  FOREIGN KEY ("tenant_id", "verified_by")
  REFERENCES "users"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_fund_releases"
  ADD CONSTRAINT "company_fund_releases_ledger_entry_fkey"
  FOREIGN KEY ("tenant_id", "ledger_entry_id")
  REFERENCES "manager_ledger_entries"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
