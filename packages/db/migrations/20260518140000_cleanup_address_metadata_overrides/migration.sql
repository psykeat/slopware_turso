DELETE FROM "tenant_fields"
WHERE "entity_name" = 'address'
  AND "field_name" IN ('addressType', 'bankAccountId');
