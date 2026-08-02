CREATE TYPE "DailyClosingStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "AuditResolutionStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "account_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ledger_id" UUID NOT NULL,
  "ledger_entry_id" UUID NOT NULL,
  "transaction_date" DATE NOT NULL,
  "transaction_type" "AccountTransactionType" NOT NULL,
  "direction" "AccountEntryDirection" NOT NULL,
  "category" "AccountExpenseCategory",
  "payment_mode" "AccountPaymentMode" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "reference_number" VARCHAR(150) NOT NULL,
  "vehicle_id" UUID,
  "booking_id" UUID,
  "driver_id" UUID,
  "employee_id" UUID,
  "partner_id" UUID,
  "details" JSONB,
  "attachment_name" VARCHAR(255),
  "remarks" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_transactions_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "account_transactions_ledger_entry_key" ON "account_transactions"("ledger_entry_id");
CREATE UNIQUE INDEX "account_transactions_tenant_id_id_key" ON "account_transactions"("tenant_id","id");
CREATE UNIQUE INDEX "account_transactions_tenant_reference_key" ON "account_transactions"("tenant_id","reference_number");
CREATE INDEX "account_transactions_tenant_date_idx" ON "account_transactions"("tenant_id","transaction_date");
CREATE INDEX "account_transactions_ledger_date_idx" ON "account_transactions"("tenant_id","ledger_id","transaction_date");
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_tenant_ledger_fkey" FOREIGN KEY ("tenant_id","ledger_id") REFERENCES "manager_ledgers"("tenant_id","id") ON DELETE RESTRICT;

CREATE TABLE "daily_closings" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "ledger_id" UUID NOT NULL,
  "closing_date" DATE NOT NULL, "opening_balance" DECIMAL(14,2) NOT NULL,
  "credits" DECIMAL(14,2) NOT NULL DEFAULT 0, "debits" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "closing_balance" DECIMAL(14,2) NOT NULL, "pending_cash_deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "DailyClosingStatus" NOT NULL DEFAULT 'OPEN', "closed_by" UUID, "closed_at" TIMESTAMPTZ(6),
  "reopened_by" UUID, "reopened_at" TIMESTAMPTZ(6), "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "daily_closings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_closings_tenant_ledger_date_key" ON "daily_closings"("tenant_id","ledger_id","closing_date");
CREATE INDEX "daily_closings_tenant_date_status_idx" ON "daily_closings"("tenant_id","closing_date","status");
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_tenant_ledger_fkey" FOREIGN KEY ("tenant_id","ledger_id") REFERENCES "manager_ledgers"("tenant_id","id") ON DELETE RESTRICT;

CREATE TABLE "account_audit_resolutions" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "exception_key" VARCHAR(255) NOT NULL,
  "status" "AuditResolutionStatus" NOT NULL DEFAULT 'OPEN', "resolution" TEXT,
  "resolved_by" UUID, "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "account_audit_resolutions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_audit_resolutions_tenant_exception_key" ON "account_audit_resolutions"("tenant_id","exception_key");
CREATE INDEX "account_audit_resolutions_tenant_status_idx" ON "account_audit_resolutions"("tenant_id","status");
ALTER TABLE "account_audit_resolutions" ADD CONSTRAINT "account_audit_resolutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
