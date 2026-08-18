CREATE SEQUENCE "tenant_code_seq" START WITH 1 INCREMENT BY 1;

SELECT setval(
  'tenant_code_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(SUBSTRING("code" FROM '^TEN([0-9]+)$')::BIGINT)
        FROM "tenants"
        WHERE "code" ~ '^TEN[0-9]+$'
      ),
      0
    ) + 1,
    1
  ),
  false
);
