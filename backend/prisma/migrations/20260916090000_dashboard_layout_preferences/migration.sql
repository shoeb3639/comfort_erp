ALTER TABLE "tenants"
ADD COLUMN "dashboard_layout" JSONB;

ALTER TABLE "users"
ADD COLUMN "dashboard_layout" JSONB;
