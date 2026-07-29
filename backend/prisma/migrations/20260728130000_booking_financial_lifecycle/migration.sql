CREATE TYPE "BillingTripType" AS ENUM ('KM_BASED', 'PACKAGE_BASED');
CREATE TYPE "CollectionPaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE');
CREATE TYPE "CollectionStatus" AS ENUM ('PENDING', 'WITH_MANAGER', 'DEPOSITED', 'VERIFIED', 'DIRECTLY_RECEIVED', 'VOID');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'GENERATED', 'CANCELLED');
CREATE TYPE "GstType" AS ENUM ('NO_GST', 'CGST_SGST', 'IGST');

CREATE TABLE "booking_closures" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "billing_trip_type" "BillingTripType" NOT NULL,
  "start_km" DECIMAL(12,2),
  "end_km" DECIMAL(12,2),
  "actual_running_km" DECIMAL(12,2) NOT NULL,
  "minimum_billing_km" DECIMAL(12,2) NOT NULL,
  "billing_km" DECIMAL(12,2) NOT NULL,
  "rate_per_km" DECIMAL(12,2),
  "package_amount" DECIMAL(12,2),
  "base_fare" DECIMAL(12,2) NOT NULL,
  "toll_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "parking" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "driver_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "other_recoverable_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total_bill_amount" DECIMAL(12,2) NOT NULL,
  "diesel_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "direct_vehicle_expense" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "driver_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allocated_office_expense" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vehicle_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_vehicle_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendor_payable_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendor_extra_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendor_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "final_vendor_payable" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendor_booking_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "attachment_name" VARCHAR(255),
  "closed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "booking_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_closures_running_km_check" CHECK (
    "actual_running_km" >= 0 AND "minimum_billing_km" >= 0 AND "billing_km" >= "actual_running_km"
  ),
  CONSTRAINT "booking_closures_amount_check" CHECK (
    "base_fare" >= 0 AND "total_bill_amount" >= 0
  )
);

CREATE TABLE "invoices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "booking_id" UUID,
  "customer_id" UUID NOT NULL,
  "invoice_number" VARCHAR(100),
  "invoice_sequence" INTEGER,
  "invoice_prefix" VARCHAR(30),
  "financial_year" VARCHAR(20),
  "invoice_date" DATE NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "gst_type" "GstType" NOT NULL DEFAULT 'NO_GST',
  "billing_name" VARCHAR(200) NOT NULL,
  "billing_address" TEXT NOT NULL,
  "customer_gstin" VARCHAR(20),
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxable_amount" DECIMAL(12,2) NOT NULL,
  "cgst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total_gst" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_payable" DECIMAL(12,2) NOT NULL,
  "generated_at" TIMESTAMPTZ(6),
  "generated_by" UUID,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancelled_by" UUID,
  "cancellation_reason" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "date_type" VARCHAR(20) NOT NULL DEFAULT 'single',
  "service_date" DATE,
  "service_start_date" DATE,
  "service_end_date" DATE,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unit" VARCHAR(30) NOT NULL,
  "rate" DECIMAL(12,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_collections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "invoice_id" UUID,
  "collection_date" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_mode" "CollectionPaymentMode" NOT NULL,
  "collected_by_name" VARCHAR(150) NOT NULL,
  "receiver_name" VARCHAR(150),
  "reference_number" VARCHAR(150),
  "remarks" TEXT,
  "deposit_date" DATE,
  "deposit_mode" VARCHAR(50),
  "deposit_reference_number" VARCHAR(150),
  "deposited_by_name" VARCHAR(150),
  "verified_by_name" VARCHAR(150),
  "status" "CollectionStatus" NOT NULL DEFAULT 'PENDING',
  "recorded_by" UUID NOT NULL,
  "verified_by" UUID,
  "verified_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "voided_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "booking_collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_collections_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "booking_closures_booking_key" ON "booking_closures"("booking_id");
CREATE UNIQUE INDEX "booking_closures_tenant_id_id_key" ON "booking_closures"("tenant_id", "id");
CREATE UNIQUE INDEX "booking_closures_tenant_booking_key" ON "booking_closures"("tenant_id", "booking_id");
CREATE INDEX "booking_closures_tenant_closed_idx" ON "booking_closures"("tenant_id", "closed_at");

CREATE UNIQUE INDEX "invoices_tenant_id_id_key" ON "invoices"("tenant_id", "id");
CREATE UNIQUE INDEX "invoices_tenant_booking_key" ON "invoices"("tenant_id", "booking_id");
CREATE UNIQUE INDEX "invoices_tenant_number_key" ON "invoices"("tenant_id", "invoice_number");
CREATE UNIQUE INDEX "invoices_tenant_sequence_key" ON "invoices"("tenant_id", "invoice_sequence");
CREATE INDEX "invoices_tenant_status_date_idx" ON "invoices"("tenant_id", "status", "invoice_date");

CREATE UNIQUE INDEX "invoice_items_tenant_id_id_key" ON "invoice_items"("tenant_id", "id");
CREATE INDEX "invoice_items_tenant_invoice_order_idx" ON "invoice_items"("tenant_id", "invoice_id", "sort_order");

CREATE UNIQUE INDEX "booking_collections_tenant_id_id_key" ON "booking_collections"("tenant_id", "id");
CREATE INDEX "booking_collections_tenant_booking_status_idx" ON "booking_collections"("tenant_id", "booking_id", "status");
CREATE INDEX "booking_collections_tenant_date_idx" ON "booking_collections"("tenant_id", "collection_date");

ALTER TABLE "booking_closures" ADD CONSTRAINT "booking_closures_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_closures" ADD CONSTRAINT "booking_closures_booking_fkey"
  FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_closures" ADD CONSTRAINT "booking_closures_closed_by_fkey"
  FOREIGN KEY ("tenant_id", "closed_by") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_fkey"
  FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_fkey"
  FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey"
  FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_fkey"
  FOREIGN KEY ("tenant_id", "updated_by") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_fkey"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_booking_fkey"
  FOREIGN KEY ("tenant_id", "booking_id") REFERENCES "bookings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_invoice_fkey"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_recorded_by_fkey"
  FOREIGN KEY ("tenant_id", "recorded_by") REFERENCES "users"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
