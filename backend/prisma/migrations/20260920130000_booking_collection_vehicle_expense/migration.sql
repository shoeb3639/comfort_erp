ALTER TABLE "booking_collections"
ADD COLUMN "vehicle_expense_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "vehicle_expense_reason" TEXT,
ADD COLUMN "returned_to_name" VARCHAR(150),
ADD COLUMN "returned_at" TIMESTAMPTZ(6),
ADD COLUMN "return_payment_mode" "CollectionPaymentMode";

ALTER TABLE "booking_collections"
ADD CONSTRAINT "booking_collections_vehicle_expense_nonnegative_check"
CHECK ("vehicle_expense_amount" >= 0);

ALTER TABLE "booking_collections"
ADD CONSTRAINT "booking_collections_vehicle_expense_reason_check"
CHECK (
  "vehicle_expense_amount" = 0
  OR NULLIF(BTRIM("vehicle_expense_reason"), '') IS NOT NULL
);
