CREATE TYPE "ManagerLedgerEntryType" AS ENUM (
  'OPENING_BALANCE',
  'FUND_RELEASE',
  'EXPENSE',
  'ADJUSTMENT',
  'FUND_RETURN',
  'DRIVER_ADVANCE',
  'DRIVER_RECOVERY',
  'PARTNER_WITHDRAWAL',
  'OWNER_WITHDRAWAL',
  'EMPLOYEE_ADVANCE',
  'REVERSAL'
);

CREATE TABLE "manager_ledgers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "manager_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_credits" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_debits" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "remarks" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "deleted_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "manager_ledgers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manager_ledgers_balance_formula_check"
    CHECK (
      "opening_balance" >= 0
      AND "total_credits" >= 0
      AND "total_debits" >= 0
      AND "current_balance" =
        "opening_balance" + "total_credits" - "total_debits"
    )
);

CREATE TABLE "manager_ledger_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ledger_id" UUID NOT NULL,
  "entry_number" INTEGER NOT NULL,
  "entry_date" DATE NOT NULL,
  "entry_type" "ManagerLedgerEntryType" NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "balance_before" DECIMAL(14,2) NOT NULL,
  "running_balance" DECIMAL(14,2) NOT NULL,
  "reference_number" VARCHAR(150),
  "source_id" UUID,
  "remarks" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manager_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manager_ledger_entries_amount_check"
    CHECK (
      "credit" >= 0
      AND "debit" >= 0
      AND NOT ("credit" > 0 AND "debit" > 0)
      AND (
        "entry_type" = 'OPENING_BALANCE'
        OR "credit" > 0
        OR "debit" > 0
      )
      AND "running_balance" = "balance_before" + "credit" - "debit"
    )
);

CREATE UNIQUE INDEX "manager_ledgers_tenant_id_id_key"
  ON "manager_ledgers"("tenant_id", "id");
CREATE UNIQUE INDEX "manager_ledgers_tenant_manager_location_key"
  ON "manager_ledgers"("tenant_id", "manager_id", "location_id");
CREATE INDEX "manager_ledgers_tenant_status_idx"
  ON "manager_ledgers"("tenant_id", "status");
CREATE INDEX "manager_ledgers_tenant_location_status_idx"
  ON "manager_ledgers"("tenant_id", "location_id", "status");

CREATE UNIQUE INDEX "manager_ledger_entries_tenant_id_id_key"
  ON "manager_ledger_entries"("tenant_id", "id");
CREATE UNIQUE INDEX "manager_ledger_entries_tenant_ledger_number_key"
  ON "manager_ledger_entries"("tenant_id", "ledger_id", "entry_number");
CREATE INDEX "manager_ledger_entries_tenant_ledger_date_idx"
  ON "manager_ledger_entries"("tenant_id", "ledger_id", "entry_date");

ALTER TABLE "manager_ledgers"
  ADD CONSTRAINT "manager_ledgers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_ledgers"
  ADD CONSTRAINT "manager_ledgers_manager_fkey"
  FOREIGN KEY ("tenant_id", "manager_id") REFERENCES "users"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_ledgers"
  ADD CONSTRAINT "manager_ledgers_location_fkey"
  FOREIGN KEY ("tenant_id", "location_id") REFERENCES "locations"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manager_ledger_entries"
  ADD CONSTRAINT "manager_ledger_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_ledger_entries"
  ADD CONSTRAINT "manager_ledger_entries_ledger_fkey"
  FOREIGN KEY ("tenant_id", "ledger_id")
  REFERENCES "manager_ledgers"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
