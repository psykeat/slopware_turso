# Table: `inventory_item`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| item_id | item_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| variant_id | variant_id | uuid | — | NOT NULL |  |
| sku | sku | text | — | NOT NULL |  |
| tracked | tracked | boolean | — | NOT NULL, DEFAULT true |  |

> INDEX `idx_inv_item_tenant` (tenant_id) [btree]
> INDEX `idx_inv_item_variant` (variant_id) [btree]

