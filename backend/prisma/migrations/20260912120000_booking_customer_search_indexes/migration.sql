CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "customers_name_search_idx"
ON "customers" USING GIN (lower("name") gin_trgm_ops)
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE INDEX "customers_billing_name_search_idx"
ON "customers" USING GIN (lower("billing_name") gin_trgm_ops)
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE INDEX "customers_phone_search_idx"
ON "customers" USING GIN ("phone" gin_trgm_ops)
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE INDEX "customer_travellers_name_search_idx"
ON "customer_travellers" USING GIN (lower("name") gin_trgm_ops)
WHERE "status" = 'ACTIVE';

CREATE INDEX "customer_travellers_phone_search_idx"
ON "customer_travellers" USING GIN ("phone" gin_trgm_ops)
WHERE "status" = 'ACTIVE';
