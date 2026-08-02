CREATE TYPE "AccountTransactionType" AS ENUM (
  'FUND_RELEASE',
  'EXPENSE',
  'ADJUSTMENT',
  'FUND_RETURN',
  'DRIVER_ADVANCE',
  'DRIVER_RECOVERY',
  'PARTNER_WITHDRAWAL',
  'OWNER_WITHDRAWAL',
  'EMPLOYEE_ADVANCE'
);

CREATE TYPE "AccountPaymentMode" AS ENUM (
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CARD',
  'CHEQUE'
);

CREATE TYPE "AccountEntryDirection" AS ENUM ('CREDIT', 'DEBIT');

CREATE TYPE "AccountExpenseCategory" AS ENUM (
  'FUEL',
  'VEHICLE_MAINTENANCE',
  'DRIVER_PAYMENT',
  'OFFICE_EXPENSE',
  'EMPLOYEE_ADVANCE',
  'PARTNER_OWNER_WITHDRAWAL',
  'RECOVERABLE_TRIP_CHARGE',
  'OTHER'
);

CREATE TYPE "AccountReferenceSource" AS ENUM (
  'COLLECTION',
  'CASH_DEPOSIT',
  'FUND_RELEASE',
  'EXPENSE',
  'ADJUSTMENT',
  'FUND_RETURN'
);

CREATE TABLE "account_references" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "reference_number" VARCHAR(150) NOT NULL,
  "normalized_reference_number" VARCHAR(150) NOT NULL,
  "source" "AccountReferenceSource" NOT NULL,
  "source_id" UUID,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "deleted_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "account_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_references_reference_number_check"
    CHECK (
      length(btrim("reference_number")) BETWEEN 3 AND 150
      AND "reference_number" ~ '^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$'
    ),
  CONSTRAINT "account_references_normalized_reference_check"
    CHECK (
      "normalized_reference_number" =
        upper(regexp_replace(btrim("reference_number"), '\s+', ' ', 'g'))
    )
);

CREATE UNIQUE INDEX "account_references_tenant_normalized_key"
  ON "account_references"("tenant_id", "normalized_reference_number");
CREATE INDEX "account_references_tenant_source_idx"
  ON "account_references"("tenant_id", "source", "source_id");
CREATE INDEX "account_references_tenant_deleted_idx"
  ON "account_references"("tenant_id", "deleted_at");

ALTER TABLE "account_references"
  ADD CONSTRAINT "account_references_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" (
  "id",
  "module",
  "action",
  "permission_key",
  "description",
  "created_at"
)
VALUES
  (md5(random()::text || clock_timestamp()::text || 'accounts.collection.view')::uuid, 'accounts.collection', 'view', 'accounts.collection.view', 'View tenant booking collections and collection balances.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.deposit.manage')::uuid, 'accounts.deposit', 'manage', 'accounts.deposit.manage', 'Manage and verify customer cash deposits.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.ledger.view')::uuid, 'accounts.ledger', 'view', 'accounts.ledger.view', 'View tenant manager ledgers and running balances.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.fund.release')::uuid, 'accounts.fund', 'release', 'accounts.fund.release', 'Release company operational funds to manager ledgers.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.expense.manage')::uuid, 'accounts.expense', 'manage', 'accounts.expense.manage', 'Create and manage operational expense transactions.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.daily_closing.manage')::uuid, 'accounts.daily_closing', 'manage', 'accounts.daily_closing.manage', 'Close and reopen daily manager accounts.', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'accounts.audit.verify')::uuid, 'accounts.audit', 'verify', 'accounts.audit.verify', 'Verify account movements and resolve audit exceptions.', CURRENT_TIMESTAMP)
ON CONFLICT ("permission_key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "tenant_role_permissions" (
  "id",
  "tenant_id",
  "role_id",
  "permission_id",
  "created_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || role."id"::text || permission."id"::text)::uuid,
  role."tenant_id",
  role."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "tenant_roles" role
JOIN "permissions" permission
  ON permission."permission_key" LIKE 'accounts.%'
WHERE role."code" IN ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

INSERT INTO "tenant_role_permissions" (
  "id",
  "tenant_id",
  "role_id",
  "permission_id",
  "created_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || role."id"::text || permission."id"::text)::uuid,
  role."tenant_id",
  role."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "tenant_roles" role
JOIN "permissions" permission
  ON permission."permission_key" IN (
    'accounts.collection.view',
    'accounts.deposit.manage',
    'accounts.ledger.view',
    'accounts.expense.manage',
    'accounts.daily_closing.manage'
  )
WHERE role."code" = 'OPERATIONS_MANAGER'
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

INSERT INTO "tenant_role_permissions" (
  "id",
  "tenant_id",
  "role_id",
  "permission_id",
  "created_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || role."id"::text || permission."id"::text)::uuid,
  role."tenant_id",
  role."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "tenant_roles" role
JOIN "permissions" permission
  ON permission."permission_key" = 'accounts.collection.view'
WHERE role."code" = 'BOOKING_EXECUTIVE'
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
