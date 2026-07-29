INSERT INTO "permissions" (
  "id",
  "module",
  "action",
  "permission_key",
  "created_at"
)
VALUES
  (md5(random()::text || clock_timestamp()::text || 'vehicle.view')::uuid, 'vehicle', 'view', 'vehicle.view', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'vehicle.manage')::uuid, 'vehicle', 'manage', 'vehicle.manage', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'driver.view')::uuid, 'driver', 'view', 'driver.view', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text || 'driver.manage')::uuid, 'driver', 'manage', 'driver.manage', CURRENT_TIMESTAMP)
ON CONFLICT ("permission_key") DO NOTHING;

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
  ON permission."permission_key" IN (
    'vehicle.view',
    'vehicle.manage',
    'driver.view',
    'driver.manage'
  )
WHERE role."code" IN ('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER')
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
