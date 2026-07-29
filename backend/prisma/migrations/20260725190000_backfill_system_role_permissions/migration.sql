-- Existing tenants may have system roles created before newer permissions were
-- introduced. Keep owner/admin roles complete when the permission catalog grows.
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
CROSS JOIN "permissions" permission
WHERE role."code" IN ('SUPER_ADMIN', 'ADMIN')
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

-- Fleet managers require the unified Vehicle and Driver master permissions used
-- by the Booking duty-assignment screen.
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
    'booking.view',
    'booking.assign',
    'vendor.view',
    'vehicle.view',
    'vehicle.manage',
    'driver.view',
    'driver.manage'
  )
WHERE role."code" = 'FLEET_MANAGER'
  AND role."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
