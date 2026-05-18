WITH RECURSIVE ordered AS (
  SELECT
    im.inventory_movement_id,
    im.tenant_id,
    im.warehouse_id,
    im.article_id,
    im.movement_type,
    im.qty_delta,
    im.absolute_qty,
    ROW_NUMBER() OVER (
      PARTITION BY im.tenant_id, im.warehouse_id, im.article_id
      ORDER BY im.movement_date, im.created_at, im.inventory_movement_id
    ) AS rn
  FROM inventory_movement im
),
running AS (
  SELECT
    inventory_movement_id,
    tenant_id,
    warehouse_id,
    article_id,
    rn,
    movement_type,
    qty_delta,
    absolute_qty,
    CASE
      WHEN movement_type = 'V' THEN COALESCE(absolute_qty, 0)
      ELSE COALESCE(qty_delta, 0)
    END AS delta,
    CASE
      WHEN movement_type = 'V' THEN COALESCE(absolute_qty, 0)
      ELSE COALESCE(qty_delta, 0)
    END AS balance_after
  FROM ordered
  WHERE rn = 1
  UNION ALL
  SELECT
    o.inventory_movement_id,
    o.tenant_id,
    o.warehouse_id,
    o.article_id,
    o.rn,
    o.movement_type,
    o.qty_delta,
    o.absolute_qty,
    CASE
      WHEN o.movement_type = 'V' THEN COALESCE(o.absolute_qty, 0) - r.balance_after
      ELSE COALESCE(o.qty_delta, 0)
    END AS delta,
    CASE
      WHEN o.movement_type = 'V' THEN COALESCE(o.absolute_qty, 0)
      ELSE r.balance_after + COALESCE(o.qty_delta, 0)
    END AS balance_after
  FROM running r
  JOIN ordered o
    ON o.tenant_id = r.tenant_id
   AND o.warehouse_id = r.warehouse_id
   AND o.article_id = r.article_id
   AND o.rn = r.rn + 1
)
UPDATE inventory_movement im
SET qty_delta = running.delta
FROM running
WHERE im.inventory_movement_id = running.inventory_movement_id
  AND im.movement_type = 'V'
  AND im.qty_delta IS NULL;
