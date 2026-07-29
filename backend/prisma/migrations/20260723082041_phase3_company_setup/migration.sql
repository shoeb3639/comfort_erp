-- CreateEnum
CREATE TYPE "SetupRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pin_code" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_name" VARCHAR(150) NOT NULL,
    "bank_name" VARCHAR(150) NOT NULL,
    "branch_name" VARCHAR(150),
    "account_number" VARCHAR(100) NOT NULL,
    "ifsc_code" VARCHAR(20) NOT NULL,
    "account_type" VARCHAR(50),
    "upi_id" VARCHAR(150),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "registration_name" VARCHAR(150) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "registration_type" VARCHAR(50) NOT NULL,
    "gstin" VARCHAR(20),
    "pan" VARCHAR(20),
    "registered_address" TEXT,
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "district" VARCHAR(100),
    "state" VARCHAR(100) NOT NULL,
    "state_code" VARCHAR(10) NOT NULL,
    "pin_code" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "effective_from" DATE,
    "effective_to" DATE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gst_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_registration_locations" (
    "tenant_id" UUID NOT NULL,
    "gst_registration_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "gst_registration_locations_pkey" PRIMARY KEY ("tenant_id","gst_registration_id","location_id")
);

-- CreateTable
CREATE TABLE "tenant_user_locations" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "tenant_user_locations_pkey" PRIMARY KEY ("tenant_id","user_id","location_id")
);

-- CreateIndex
CREATE INDEX "locations_tenant_status_idx" ON "locations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenant_id_id_key" ON "locations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenant_code_key" ON "locations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "bank_accounts_tenant_status_idx" ON "tenant_bank_accounts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_tenant_account_number_key" ON "tenant_bank_accounts"("tenant_id", "account_number");

-- CreateIndex
CREATE INDEX "gst_registrations_tenant_status_idx" ON "gst_registrations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_registrations_tenant_id_id_key" ON "gst_registrations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_registrations_tenant_gstin_key" ON "gst_registrations"("tenant_id", "gstin");

-- CreateIndex
CREATE INDEX "gst_registration_locations_tenant_location_idx" ON "gst_registration_locations"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "user_locations_tenant_location_idx" ON "tenant_user_locations"("tenant_id", "location_id");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_bank_accounts" ADD CONSTRAINT "tenant_bank_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_registrations" ADD CONSTRAINT "gst_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_registration_locations" ADD CONSTRAINT "gst_registration_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_registration_locations" ADD CONSTRAINT "gst_registration_locations_tenant_id_gst_registration_id_fkey" FOREIGN KEY ("tenant_id", "gst_registration_id") REFERENCES "gst_registrations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_registration_locations" ADD CONSTRAINT "gst_registration_locations_tenant_id_location_id_fkey" FOREIGN KEY ("tenant_id", "location_id") REFERENCES "locations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_locations" ADD CONSTRAINT "tenant_user_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_locations" ADD CONSTRAINT "tenant_user_locations_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_locations" ADD CONSTRAINT "tenant_user_locations_tenant_id_location_id_fkey" FOREIGN KEY ("tenant_id", "location_id") REFERENCES "locations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
