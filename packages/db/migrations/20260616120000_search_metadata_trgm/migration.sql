CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_article_article_no_trgm
  ON "article" USING gin ("article_no" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_article_name_trgm
  ON "article" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_address_address_no_trgm
  ON "address" USING gin ("address_no" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_address_company_name_trgm
  ON "address" USING gin ("company_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_address_city_trgm
  ON "address" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_address_search_text_trgm
  ON "address" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('article', 'articleNo', 'text', '{"en":"articleNo","de":"articleNo"}'::jsonb),
      ('article', 'name', 'text', '{"en":"name","de":"name"}'::jsonb),
      ('address', 'addressNo', 'text', '{"en":"addressNo","de":"addressNo"}'::jsonb),
      ('address', 'companyName', 'text', '{"en":"companyName","de":"companyName"}'::jsonb),
      ('address', 'city', 'text', '{"en":"city","de":"city"}'::jsonb),
      ('address', 'searchText', 'text', '{"en":"searchText","de":"searchText"}'::jsonb)
    ) AS seed(entity_name, field_name, field_type, label)
  LOOP
    UPDATE tenant_fields
    SET custom_attributes = jsonb_set(
          coalesce(custom_attributes, '{}'::jsonb),
          '{search}',
          '{"enabled":true}'::jsonb,
          true
        )
    WHERE scope = 'global'
      AND entity_name = rec.entity_name
      AND field_name = rec.field_name;

    IF NOT FOUND THEN
      INSERT INTO tenant_fields (
        scope,
        entity_name,
        field_name,
        field_type,
        label,
        is_visible,
        custom_attributes
      )
      VALUES (
        'global',
        rec.entity_name,
        rec.field_name,
        rec.field_type,
        rec.label,
        true,
        '{"search":{"enabled":true}}'::jsonb
      );
    END IF;
  END LOOP;
END $$;
