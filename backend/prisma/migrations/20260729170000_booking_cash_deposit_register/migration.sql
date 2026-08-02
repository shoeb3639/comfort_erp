CREATE TYPE "CashDepositStatus" AS ENUM (
  'COLLECTED',
  'WITH_MANAGER',
  'DEPOSITED',
  'VERIFIED',
  'MISMATCH',
  'VOID'
);

CREATE TYPE "CashDepositMode" AS ENUM (
  'CASH_DEPOSIT',
  'UPI',
  'BANK_TRANSFER'
);

CREATE TABLE "booking_cash_deposits" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "collection_id" UUID NOT NULL,
  "amount_collected" DECIMAL(12,2) NOT NULL,
  "deposited_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "receiver_manager_id" UUID,
  "receiver_manager_name" VARCHAR(150),
  "received_at" TIMESTAMPTZ(6),
  "status" "CashDepositStatus" NOT NULL DEFAULT 'COLLECTED',
  "deposit_date" DATE,
  "deposit_mode" "CashDepositMode",
  "bank_reference" VARCHAR(150),
  "attachment_name" VARCHAR(255),
  "deposited_by" UUID,
  "deposited_by_name" VARCHAR(150),
  "verified_amount" DECIMAL(12,2),
  "verified_by" UUID,
  "verified_by_name" VARCHAR(150),
  "verified_at" TIMESTAMPTZ(6),
  "mismatch_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "mismatch_reason" TEXT,
  "remarks" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "deleted_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "booking_cash_deposits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_cash_deposits_amount_check"
    CHECK (
      "amount_collected" > 0
      AND "deposited_amount" >= 0
      AND "deposited_amount" <= "amount_collected"
      AND ("verified_amount" IS NULL OR (
        "verified_amount" >= 0
        AND "verified_amount" <= "amount_collected"
      ))
      AND "mismatch_amount" >= 0
    )
);

CREATE UNIQUE INDEX "booking_cash_deposits_tenant_id_id_key"
  ON "booking_cash_deposits"("tenant_id", "id");
CREATE UNIQUE INDEX "booking_cash_deposits_tenant_collection_key"
  ON "booking_cash_deposits"("tenant_id", "collection_id");
CREATE INDEX "booking_cash_deposits_tenant_status_date_idx"
  ON "booking_cash_deposits"("tenant_id", "status", "deposit_date");
CREATE INDEX "booking_cash_deposits_tenant_manager_status_idx"
  ON "booking_cash_deposits"("tenant_id", "receiver_manager_id", "status");

ALTER TABLE "booking_cash_deposits"
  ADD CONSTRAINT "booking_cash_deposits_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_cash_deposits"
  ADD CONSTRAINT "booking_cash_deposits_collection_fkey"
  FOREIGN KEY ("tenant_id", "collection_id")
  REFERENCES "booking_collections"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "booking_cash_deposits" (
  "id",
  "tenant_id",
  "collection_id",
  "amount_collected",
  "deposited_amount",
  "receiver_manager_name",
  "status",
  "deposit_date",
  "deposit_mode",
  "bank_reference",
  "deposited_by_name",
  "verified_amount",
  "verified_by",
  "verified_by_name",
  "verified_at",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || collection."id"::text)::uuid,
  collection."tenant_id",
  collection."id",
  collection."amount",
  CASE
    WHEN collection."status" IN ('DEPOSITED', 'VERIFIED') THEN collection."amount"
    ELSE 0
  END,
  collection."receiver_name",
  CASE collection."status"
    WHEN 'WITH_MANAGER' THEN 'WITH_MANAGER'::"CashDepositStatus"
    WHEN 'DEPOSITED' THEN 'DEPOSITED'::"CashDepositStatus"
    WHEN 'VERIFIED' THEN 'VERIFIED'::"CashDepositStatus"
    WHEN 'VOID' THEN 'VOID'::"CashDepositStatus"
    ELSE 'COLLECTED'::"CashDepositStatus"
  END,
  collection."deposit_date",
  CASE upper(replace(coalesce(collection."deposit_mode", ''), ' ', '_'))
    WHEN 'UPI' THEN 'UPI'::"CashDepositMode"
    WHEN 'BANK_TRANSFER' THEN 'BANK_TRANSFER'::"CashDepositMode"
    WHEN 'CASH_DEPOSIT' THEN 'CASH_DEPOSIT'::"CashDepositMode"
    ELSE NULL
  END,
  collection."deposit_reference_number",
  collection."deposited_by_name",
  CASE
    WHEN collection."status" = 'VERIFIED' THEN collection."amount"
    ELSE NULL
  END,
  collection."verified_by",
  collection."verified_by_name",
  collection."verified_at",
  collection."recorded_by",
  collection."recorded_by",
  collection."created_at",
  collection."updated_at"
FROM "booking_collections" collection
WHERE collection."payment_mode" = 'CASH';
