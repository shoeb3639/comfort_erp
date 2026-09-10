ALTER TABLE "booking_collections"
  ADD COLUMN "custodian_driver_id" UUID,
  ADD COLUMN "fuel_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fuel_receipt_id" UUID,
  ADD COLUMN "payment_holder" VARCHAR(20) NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "returned_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "booking_collections_fuel_receipt_key" ON "booking_collections"("tenant_id", "fuel_receipt_id");
ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_tenant_id_fuel_receipt_id_fkey"
  FOREIGN KEY ("tenant_id", "fuel_receipt_id") REFERENCES "stored_files"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_collections" ADD CONSTRAINT "booking_collections_driver_funds_check" CHECK (
  "payment_holder" IN ('COMPANY', 'DRIVER')
  AND "fuel_amount" >= 0 AND "returned_amount" >= 0
  AND ("payment_holder" <> 'DRIVER' OR "fuel_amount" + "returned_amount" <= "amount")
  AND ("fuel_amount" = 0 OR "fuel_receipt_id" IS NOT NULL)
  AND ("payment_holder" = 'DRIVER' OR ("fuel_amount" = 0 AND "returned_amount" = 0 AND "fuel_receipt_id" IS NULL))
);
