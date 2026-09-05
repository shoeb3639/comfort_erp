CREATE TABLE "stored_files" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" UUID NOT NULL,
  "document_type" VARCHAR(50),
  "original_file_name" VARCHAR(255) NOT NULL,
  "stored_file_name" VARCHAR(255) NOT NULL,
  "storage_provider" VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
  "storage_key" VARCHAR(1000) NOT NULL,
  "mime_type" VARCHAR(150) NOT NULL,
  "extension" VARCHAR(20),
  "file_size" BIGINT NOT NULL,
  "checksum" VARCHAR(128),
  "uploaded_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by_id" UUID,
  CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_files_tenant_id_key" ON "stored_files"("tenant_id", "id");
CREATE UNIQUE INDEX "stored_files_tenant_storage_key" ON "stored_files"("tenant_id", "storage_key");
CREATE INDEX "stored_files_entity_idx" ON "stored_files"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "stored_files_document_type_idx" ON "stored_files"("tenant_id", "document_type");
CREATE INDEX "stored_files_created_at_idx" ON "stored_files"("tenant_id", "created_at");
CREATE INDEX "stored_files_deleted_at_idx" ON "stored_files"("tenant_id", "deleted_at");

ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "module", "action", "permission_key", "created_at")
VALUES
  (md5(random()::text || clock_timestamp()::text || 'files.upload')::uuid, 'files', 'upload', 'files.upload', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'files.view')::uuid, 'files', 'view', 'files.view', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'files.download')::uuid, 'files', 'download', 'files.download', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'files.delete')::uuid, 'files', 'delete', 'files.delete', CURRENT_TIMESTAMP)
ON CONFLICT ("permission_key") DO NOTHING;

INSERT INTO "tenant_role_permissions" (
  "id", "tenant_id", "role_id", "permission_id", "created_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || role."id"::text || permission."id"::text)::uuid,
  role."tenant_id",
  role."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "tenant_roles" role
JOIN "permissions" permission ON permission."permission_key" IN (
  'files.upload', 'files.view', 'files.download', 'files.delete'
)
WHERE role."code" IN ('SUPER_ADMIN', 'ADMIN')
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
