ALTER TABLE "booking_closures" ADD COLUMN "fuel_consumed_litres" DECIMAL(12,2);
ALTER TABLE "booking_closures" ADD CONSTRAINT "booking_closures_fuel_consumed_nonnegative"
  CHECK ("fuel_consumed_litres" IS NULL OR "fuel_consumed_litres" >= 0);
