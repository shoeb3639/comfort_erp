CREATE TYPE "VehicleOwnershipType" AS ENUM ('OWN', 'VENDOR');
CREATE TYPE "DriverEngagementType" AS ENUM ('OWN', 'VENDOR');

CREATE TABLE "vehicle_types" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_types_tenant_id_id_key" ON "vehicle_types"("tenant_id", "id");
CREATE UNIQUE INDEX "vehicle_types_tenant_name_key" ON "vehicle_types"("tenant_id", "name");
CREATE INDEX "vehicle_types_tenant_status_idx" ON "vehicle_types"("tenant_id", "status");
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_vehicles" RENAME TO "vehicles";
ALTER TABLE "vendor_drivers" RENAME TO "drivers";

ALTER TABLE "vehicles" RENAME COLUMN "plate" TO "registration_number";
ALTER TABLE "drivers" RENAME COLUMN "ownership_type" TO "engagement_type";
ALTER TABLE "drivers" RENAME COLUMN "license" TO "licence_number";
ALTER TABLE "drivers" RENAME COLUMN "phone" TO "mobile";

ALTER TABLE "vehicles" ADD COLUMN "vehicle_type_id" UUID;
ALTER TABLE "vehicles" ADD COLUMN "model" VARCHAR(150);
ALTER TABLE "vehicles" ADD COLUMN "variant" VARCHAR(150);
ALTER TABLE "vehicles" ADD COLUMN "fuel_type" VARCHAR(50);
ALTER TABLE "vehicles" ADD COLUMN "manufacturing_year" SMALLINT;
ALTER TABLE "vehicles" ADD COLUMN "registration_date" DATE;
ALTER TABLE "vehicles" ADD COLUMN "insurance_expiry" DATE;
ALTER TABLE "vehicles" ADD COLUMN "permit_expiry" DATE;
ALTER TABLE "vehicles" ADD COLUMN "fitness_expiry" DATE;
ALTER TABLE "drivers" ADD COLUMN "alternate_mobile" VARCHAR(30);
ALTER TABLE "drivers" ADD COLUMN "licence_type" VARCHAR(100);
ALTER TABLE "drivers" ADD COLUMN "licence_expiry" DATE;
ALTER TABLE "drivers" ADD COLUMN "address" TEXT;
ALTER TABLE "drivers" ADD COLUMN "identity_details" JSONB;

INSERT INTO "vehicle_types" ("id", "tenant_id", "name", "updated_at")
SELECT gen_random_uuid(), "tenant_id", INITCAP(TRIM("type")), CURRENT_TIMESTAMP
FROM "vehicles"
GROUP BY "tenant_id", INITCAP(TRIM("type"));

UPDATE "vehicles" v
SET "vehicle_type_id" = vt."id"
FROM "vehicle_types" vt
WHERE vt."tenant_id" = v."tenant_id" AND vt."name" = INITCAP(TRIM(v."type"));

UPDATE "vehicles" v
SET "vendor_id" = NULL
FROM "vendors" ven
WHERE ven."tenant_id" = v."tenant_id"
  AND ven."id" = v."vendor_id"
  AND ven."record_type" = 'own_company';

ALTER TABLE "vehicles"
  ALTER COLUMN "vendor_id" DROP NOT NULL,
  ALTER COLUMN "ownership_type" TYPE "VehicleOwnershipType"
    USING UPPER("ownership_type")::"VehicleOwnershipType",
  ALTER COLUMN "vehicle_type_id" SET NOT NULL,
  ALTER COLUMN "make" DROP NOT NULL,
  ALTER COLUMN "seating_capacity" DROP NOT NULL,
  ALTER COLUMN "status" TYPE "SetupRecordStatus"
    USING (CASE WHEN LOWER("status") IN ('inactive', 'maintenance', 'offline') THEN 'INACTIVE' ELSE 'ACTIVE' END)::"SetupRecordStatus";

ALTER TABLE "drivers"
  ALTER COLUMN "vendor_id" DROP NOT NULL,
  ALTER COLUMN "engagement_type" TYPE "DriverEngagementType"
    USING UPPER("engagement_type")::"DriverEngagementType",
  ALTER COLUMN "licence_number" DROP NOT NULL,
  ALTER COLUMN "status" TYPE "SetupRecordStatus"
    USING (CASE WHEN LOWER("status") IN ('inactive', 'offline') THEN 'INACTIVE' ELSE 'ACTIVE' END)::"SetupRecordStatus";

UPDATE "drivers" d
SET "vendor_id" = NULL
FROM "vendors" ven
WHERE ven."tenant_id" = d."tenant_id"
  AND ven."id" = d."vendor_id"
  AND ven."record_type" = 'own_company';

ALTER TABLE "vehicles" DROP COLUMN "type";
ALTER TABLE "drivers" DROP COLUMN "city";

ALTER TABLE "vehicles" DROP CONSTRAINT "vendor_vehicles_tenant_id_vendor_id_fkey";
ALTER TABLE "drivers" DROP CONSTRAINT "vendor_drivers_tenant_id_vendor_id_fkey";
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_vendor_id_fkey"
  FOREIGN KEY ("tenant_id", "vendor_id") REFERENCES "vendors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_vendor_id_fkey"
  FOREIGN KEY ("tenant_id", "vendor_id") REFERENCES "vendors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_vehicle_type_id_fkey"
  FOREIGN KEY ("tenant_id", "vehicle_type_id") REFERENCES "vehicle_types"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_ownership_vendor_check" CHECK (
  ("ownership_type" = 'OWN' AND "vendor_id" IS NULL)
  OR ("ownership_type" = 'VENDOR' AND "vendor_id" IS NOT NULL)
);
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_engagement_vendor_check" CHECK (
  ("engagement_type" = 'OWN' AND "vendor_id" IS NULL)
  OR ("engagement_type" = 'VENDOR' AND "vendor_id" IS NOT NULL)
);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_manufacturing_year_check" CHECK (
  "manufacturing_year" IS NULL OR "manufacturing_year" BETWEEN 1900 AND 2100
);

DROP INDEX "vendor_vehicles_tenant_plate_key";
DROP INDEX "vendor_drivers_tenant_license_key";
CREATE UNIQUE INDEX "vehicles_tenant_registration_active_key"
  ON "vehicles"("tenant_id", "registration_number") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "drivers_tenant_licence_active_key"
  ON "drivers"("tenant_id", "licence_number")
  WHERE "deleted_at" IS NULL AND "licence_number" IS NOT NULL;

ALTER INDEX "vendor_vehicles_tenant_id_id_key" RENAME TO "vehicles_tenant_id_id_key";
ALTER INDEX "vendor_vehicles_tenant_code_key" RENAME TO "vehicles_tenant_code_key";
ALTER INDEX "vendor_vehicles_tenant_vendor_idx" RENAME TO "vehicles_tenant_vendor_idx";
ALTER INDEX "vendor_drivers_tenant_id_id_key" RENAME TO "drivers_tenant_id_id_key";
ALTER INDEX "vendor_drivers_tenant_code_key" RENAME TO "drivers_tenant_code_key";
ALTER INDEX "vendor_drivers_tenant_vendor_idx" RENAME TO "drivers_tenant_vendor_idx";

CREATE INDEX "vehicles_tenant_ownership_status_idx" ON "vehicles"("tenant_id", "ownership_type", "status");
CREATE INDEX "vehicles_tenant_type_idx" ON "vehicles"("tenant_id", "vehicle_type_id");
CREATE INDEX "drivers_tenant_engagement_status_idx" ON "drivers"("tenant_id", "engagement_type", "status");
