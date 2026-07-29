-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "record_type" VARCHAR(50) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "phone" VARCHAR(30) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "status" "SetupRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_vehicles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "vehicle_code" VARCHAR(50) NOT NULL,
    "ownership_type" VARCHAR(30) NOT NULL,
    "plate" VARCHAR(30) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "make" VARCHAR(150) NOT NULL,
    "seating_capacity" INTEGER NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vendor_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_drivers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "driver_code" VARCHAR(50) NOT NULL,
    "ownership_type" VARCHAR(30) NOT NULL,
    "salutation" "Salutation",
    "name" VARCHAR(150) NOT NULL,
    "license" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vendor_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_tenant_status_idx" ON "vendors"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenant_id_id_key" ON "vendors"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenant_code_key" ON "vendors"("tenant_id", "vendor_code");

-- CreateIndex
CREATE INDEX "vendor_vehicles_tenant_vendor_idx" ON "vendor_vehicles"("tenant_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_vehicles_tenant_id_id_key" ON "vendor_vehicles"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_vehicles_tenant_code_key" ON "vendor_vehicles"("tenant_id", "vehicle_code");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_vehicles_tenant_plate_key" ON "vendor_vehicles"("tenant_id", "plate");

-- CreateIndex
CREATE INDEX "vendor_drivers_tenant_vendor_idx" ON "vendor_drivers"("tenant_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_drivers_tenant_id_id_key" ON "vendor_drivers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_drivers_tenant_code_key" ON "vendor_drivers"("tenant_id", "driver_code");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_drivers_tenant_license_key" ON "vendor_drivers"("tenant_id", "license");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_vehicles" ADD CONSTRAINT "vendor_vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_vehicles" ADD CONSTRAINT "vendor_vehicles_tenant_id_vendor_id_fkey" FOREIGN KEY ("tenant_id", "vendor_id") REFERENCES "vendors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_drivers" ADD CONSTRAINT "vendor_drivers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_drivers" ADD CONSTRAINT "vendor_drivers_tenant_id_vendor_id_fkey" FOREIGN KEY ("tenant_id", "vendor_id") REFERENCES "vendors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
