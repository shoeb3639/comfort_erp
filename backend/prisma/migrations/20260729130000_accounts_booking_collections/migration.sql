CREATE INDEX "booking_collections_tenant_mode_status_date_idx"
  ON "booking_collections"("tenant_id", "payment_mode", "status", "collection_date");

INSERT INTO "account_references" (
  "id",
  "tenant_id",
  "reference_number",
  "normalized_reference_number",
  "source",
  "source_id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (
  collection."tenant_id",
  upper(regexp_replace(btrim(collection."reference_number"), '\s+', ' ', 'g'))
)
  md5(
    random()::text ||
    clock_timestamp()::text ||
    collection."tenant_id"::text ||
    collection."id"::text ||
    'COLLECTION'
  )::uuid,
  collection."tenant_id",
  btrim(collection."reference_number"),
  upper(regexp_replace(btrim(collection."reference_number"), '\s+', ' ', 'g')),
  'COLLECTION'::"AccountReferenceSource",
  collection."id",
  collection."recorded_by",
  collection."recorded_by",
  collection."created_at",
  collection."updated_at"
FROM "booking_collections" collection
WHERE collection."reference_number" IS NOT NULL
  AND length(btrim(collection."reference_number")) >= 3
  AND collection."reference_number" ~ '^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$'
ORDER BY
  collection."tenant_id",
  upper(regexp_replace(btrim(collection."reference_number"), '\s+', ' ', 'g')),
  collection."created_at",
  collection."id"
ON CONFLICT ("tenant_id", "normalized_reference_number") DO NOTHING;

INSERT INTO "account_references" (
  "id",
  "tenant_id",
  "reference_number",
  "normalized_reference_number",
  "source",
  "source_id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (
  collection."tenant_id",
  upper(regexp_replace(btrim(collection."deposit_reference_number"), '\s+', ' ', 'g'))
)
  md5(
    random()::text ||
    clock_timestamp()::text ||
    collection."tenant_id"::text ||
    collection."id"::text ||
    'CASH_DEPOSIT'
  )::uuid,
  collection."tenant_id",
  btrim(collection."deposit_reference_number"),
  upper(regexp_replace(btrim(collection."deposit_reference_number"), '\s+', ' ', 'g')),
  'CASH_DEPOSIT'::"AccountReferenceSource",
  collection."id",
  collection."recorded_by",
  collection."recorded_by",
  collection."created_at",
  collection."updated_at"
FROM "booking_collections" collection
WHERE collection."deposit_reference_number" IS NOT NULL
  AND length(btrim(collection."deposit_reference_number")) >= 3
  AND collection."deposit_reference_number" ~ '^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$'
ORDER BY
  collection."tenant_id",
  upper(regexp_replace(btrim(collection."deposit_reference_number"), '\s+', ' ', 'g')),
  collection."created_at",
  collection."id"
ON CONFLICT ("tenant_id", "normalized_reference_number") DO NOTHING;
