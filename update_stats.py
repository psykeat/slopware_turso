import re

path = 'apps/web/src/routes/api/stats/article/$articleId.ts'
with open(path, 'r') as f:
    content = f.read()

new_query = """SELECT
                im.inventory_movement_id,
                im.movement_type,
                im.qty_delta,
                im.movement_date,
                im.created_at,
                im.warehouse_id,
                im.reference_text,
                d.document_no,
                w.name AS warehouse_name,
                v.sku AS variant_sku,
                v.variant_id,
                SUM(COALESCE(im.qty_delta, 0)) OVER (
                  PARTITION BY im.variant_id, im.warehouse_id
                  ORDER BY im.created_at, im.inventory_movement_id
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS running_balance
              FROM inventory_movement im
              LEFT JOIN article_variant v ON im.variant_id = v.variant_id
              LEFT JOIN document d ON im.source_document_id = d.document_id
              LEFT JOIN warehouse w ON im.warehouse_id = w.warehouse_id
              WHERE im.tenant_id = ${tenantId}::uuid
                AND v.article_id = ${articleId}::uuid"""

# We need to replace the FROM and WHERE inside the query.
# Let's just replace the whole query.
old_query_pattern = re.compile(r'SELECT\s+im\.inventory_movement_id,.*?AND im\.variant_id = \$\{articleId\}::uuid', re.DOTALL)

content = old_query_pattern.sub(new_query, content)

with open(path, 'w') as f:
    f.write(content)
