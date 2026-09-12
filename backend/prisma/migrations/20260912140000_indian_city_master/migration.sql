CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "indian_cities" (
    "id" UUID NOT NULL,
    "source_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "state_name" VARCHAR(150) NOT NULL,
    "state_code" VARCHAR(10) NOT NULL,
    "latitude" DECIMAL(11,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "indian_cities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "indian_cities_source_id_key" ON "indian_cities"("source_id");
CREATE INDEX "indian_cities_name_idx" ON "indian_cities"("name");
CREATE INDEX "indian_cities_state_name_idx" ON "indian_cities"("state_name", "name");
CREATE INDEX "indian_cities_name_search_idx" ON "indian_cities" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX "indian_cities_state_search_idx" ON "indian_cities" USING GIN (lower("state_name") gin_trgm_ops);
