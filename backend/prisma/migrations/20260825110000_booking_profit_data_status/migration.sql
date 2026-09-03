CREATE TYPE "BookingProfitDataStatus" AS ENUM (
  'NOT_TRACKED',
  'AVAILABLE',
  'INCOMPLETE',
  'REGISTER_ONLY'
);

ALTER TABLE "booking_closures"
  ADD COLUMN "commission_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "profit_data_status" "BookingProfitDataStatus" NOT NULL DEFAULT 'AVAILABLE';

CREATE INDEX "booking_closures_tenant_profit_status_idx"
  ON "booking_closures"("tenant_id", "profit_data_status");
