ALTER TABLE "tenants" ADD COLUMN "sms_prefix" VARCHAR(12);
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_sms_prefix_format_check"
  CHECK ("sms_prefix" IS NULL OR "sms_prefix" ~ '^[A-Z0-9]{2,12}$');
