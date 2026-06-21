# Table: `inventory_balance`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_balance_id  | inventory_balance_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| company_id            | company_id            | uuid                     | —     |                            |             |
| warehouse_id          | warehouse_id          | uuid                     | —     | NOT NULL                   |             |
| inventory_item_id     | inventory_item_id     | uuid                     | —     |                            |             |
| article_id            | article_id            | uuid                     | —     |                            |             |
| on_hand_qty           | on_hand_qty           | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| reserved_qty          | reserved_qty          | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| as_of_at              | as_of_at              | timestamp with time zone | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| available_qty         | available_qty         | numeric                  | —     |                            |             |
| expected_purchase_qty | expected_purchase_qty | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| gld_purchase          | gld_purchase          | numeric                  | —     |                            |             |
| gld_cost              | gld_cost              | numeric                  | —     |                            |             |

> INDEX `idx_inv_balance_lookup` (tenant_id, warehouse_id, inventory_item_id) [btree]
> INDEX `idx_inv_balance_article` (tenant_id, warehouse_id, article_id) [btree]
> INDEX `idx_inv_balance_tenant` (tenant_id) [btree]
