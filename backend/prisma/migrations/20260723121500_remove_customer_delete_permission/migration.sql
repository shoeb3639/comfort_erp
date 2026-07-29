DELETE FROM "tenant_role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "permission_key" = 'customer.delete'
);

DELETE FROM "permissions"
WHERE "permission_key" = 'customer.delete';
