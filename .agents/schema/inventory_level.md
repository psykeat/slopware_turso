# Table: `inventory_level`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| level_id | level_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| item_id | item_id | uuid | — | NOT NULL |  |
| location_id | location_id | uuid | — | NOT NULL |  |
| quantity | quantity | numeric | — | NOT NULL, DEFAULT 0 |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_inv_level_tenant` (tenant_id) [btree]
> INDEX `idx_inv_level_item` (item_id) [btree]

