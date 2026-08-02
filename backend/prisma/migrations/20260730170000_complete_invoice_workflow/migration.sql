ALTER TABLE "invoices"
  ADD COLUMN "reference_number" VARCHAR(150),
  ADD COLUMN "billing_type" VARCHAR(50),
  ADD COLUMN "billing_contact" VARCHAR(200),
  ADD COLUMN "billing_mobile" VARCHAR(30),
  ADD COLUMN "billing_email" VARCHAR(255),
  ADD COLUMN "vehicle_description" VARCHAR(255),
  ADD COLUMN "service_city" VARCHAR(150),
  ADD COLUMN "place_of_supply" VARCHAR(150),
  ADD COLUMN "hsn_code" VARCHAR(30),
  ADD COLUMN "payment_terms" VARCHAR(255),
  ADD COLUMN "terms" TEXT,
  ADD COLUMN "display_snapshot" JSONB;

CREATE INDEX "invoices_tenant_customer_date_idx"
  ON "invoices"("tenant_id", "customer_id", "invoice_date");
