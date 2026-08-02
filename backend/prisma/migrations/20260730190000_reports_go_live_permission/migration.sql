INSERT INTO "permissions" (
  "id",
  "module",
  "action",
  "permission_key",
  "description",
  "created_at"
)
VALUES (
  md5(random()::text || clock_timestamp()::text || 'reports.view')::uuid,
  'reports',
  'view',
  'reports.view',
  'View and export tenant operational and financial reports.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("permission_key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "tenant_role_permissions" (
  "id",
  "tenant_id",
  "role_id",
  "permission_id",
  "created_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || role."id"::text || permission."id"::text)::uuid,
  role."tenant_id",
  role."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "tenant_roles" role
JOIN "permissions" permission
  ON permission."permission_key" = 'reports.view'
WHERE role."code" IN (
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'ACCOUNTANT',
  'FLEET_MANAGER'
)
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
