CREATE INDEX "account_transactions_tenant_vehicle_date_idx"
  ON "account_transactions"("tenant_id", "vehicle_id", "transaction_date");

CREATE INDEX "account_transactions_tenant_booking_date_idx"
  ON "account_transactions"("tenant_id", "booking_id", "transaction_date");
