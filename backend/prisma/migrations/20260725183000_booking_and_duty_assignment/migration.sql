CREATE TYPE "BookingStatus" AS ENUM (
  'DRAFT', 'CONFIRMED', 'ASSIGNED', 'RUNNING', 'COMPLETED', 'CLOSED', 'CANCELLED'
);
CREATE TYPE "BookingType" AS ENUM (
  'PACKAGE', 'LOCAL', 'AIRPORT_TRANSFER', 'RAILWAY_STATION_TRANSFER', 'OUTSTATION'
);
CREATE TYPE "AssignmentSource" AS ENUM ('OWN', 'VENDOR');
CREATE TYPE "PricingBasis" AS ENUM ('FIXED', 'RATE_PER_KM');
CREATE TYPE "TripType" AS ENUM ('ONE_WAY', 'ROUNDTRIP', 'MULTI_CITY');

ALTER TABLE "tenants" ADD COLUMN "booking_prefix" CHAR(4);
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_booking_prefix_format_check"
  CHECK ("booking_prefix" IS NULL OR "booking_prefix" ~ '^[A-Z0-9]{4}$');
CREATE UNIQUE INDEX "tenants_booking_prefix_key" ON "tenants"("booking_prefix");

CREATE TABLE "bookings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "booking_number" VARCHAR(11) NOT NULL,
  "booking_sequence" INTEGER NOT NULL,
  "customer_id" UUID NOT NULL,
  "traveller_id" UUID,
  "booking_type" "BookingType" NOT NULL,
  "booking_package" VARCHAR(100),
  "trip_type" "TripType" NOT NULL DEFAULT 'ONE_WAY',
  "service_city" VARCHAR(100) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "pickup_time" VARCHAR(5) NOT NULL,
  "pickup_location" VARCHAR(500) NOT NULL,
  "drop_location" VARCHAR(500),
  "route_stops" TEXT,
  "package_details" TEXT,
  "requested_vehicle_type" VARCHAR(150) NOT NULL,
  "assignment_source" "AssignmentSource" NOT NULL DEFAULT 'OWN',
  "vendor_id" UUID,
  "vehicle_id" UUID,
  "driver_id" UUID,
  "pricing_basis" "PricingBasis" NOT NULL,
  "customer_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendor_rate_type" VARCHAR(50),
  "vendor_rate" DECIMAL(12,2),
  "vendor_payable_amount" DECIMAL(12,2),
  "vendor_notes" TEXT,
  "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "notes" TEXT,
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_date_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "bookings_number_format_check"
    CHECK ("booking_number" ~ '^[A-Z0-9]{4}-[0-9]{6}$'),
  CONSTRAINT "bookings_sequence_check"
    CHECK ("booking_sequence" BETWEEN 100000 AND 999999),
  CONSTRAINT "bookings_assignment_check" CHECK (
    ("assignment_source" = 'OWN' AND "vendor_id" IS NULL)
    OR ("assignment_source" = 'VENDOR' AND "vendor_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "bookings_number_key" ON "bookings"("booking_number");
CREATE UNIQUE INDEX "bookings_sequence_key" ON "bookings"("booking_sequence");
CREATE UNIQUE INDEX "bookings_tenant_id_id_key" ON "bookings"("tenant_id", "id");
CREATE INDEX "bookings_tenant_status_start_idx" ON "bookings"("tenant_id", "status", "start_date");
CREATE INDEX "bookings_tenant_customer_idx" ON "bookings"("tenant_id", "customer_id");
CREATE INDEX "bookings_tenant_vendor_idx" ON "bookings"("tenant_id", "vendor_id");
CREATE INDEX "bookings_tenant_vehicle_dates_idx" ON "bookings"("tenant_id", "vehicle_id", "start_date", "end_date");
CREATE INDEX "bookings_tenant_driver_dates_idx" ON "bookings"("tenant_id", "driver_id", "start_date", "end_date");

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_customer_fkey"
  FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_traveller_fkey"
  FOREIGN KEY ("tenant_id", "traveller_id") REFERENCES "customer_travellers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_vendor_fkey"
  FOREIGN KEY ("tenant_id", "vendor_id") REFERENCES "vendors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_vehicle_fkey"
  FOREIGN KEY ("tenant_id", "vehicle_id") REFERENCES "vehicles"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_driver_fkey"
  FOREIGN KEY ("tenant_id", "driver_id") REFERENCES "drivers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
