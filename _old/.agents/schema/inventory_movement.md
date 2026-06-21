# Table: `inventory_movement`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_movement_id   | inventory_movement_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     |                            |             |
| warehouse_id            | warehouse_id            | uuid                     | —     | NOT NULL                   |             |
| inventory_item_id       | inventory_item_id       | uuid                     | —     | NOT NULL                   |             |
| variant_id              | variant_id              | uuid                     | —     |                            |             |
| movement_type           | movement_type           | char(1)                  | —     | NOT NULL                   |             |
| qty_delta               | qty_delta               | numeric                  | —     |                            |             |
| movement_date           | movement_date           | timestamp with time zone | —     | NOT NULL                   |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| absolute_qty            | absolute_qty            | numeric                  | —     |                            |             |
| reference_text          | reference_text          | text                     | —     |                            |             |
| serial_number_id        | serial_number_id        | uuid                     | —     |                            |             |
| batch_no                | batch_no                | text                     | —     |                            |             |

> INDEX `idx_inv_movement_date` (tenant_id, movement_date) [btree]
> INDEX `idx_inv_movement_inventory_item_anchor` (tenant_id, warehouse_id, inventory_item_id, variant_id, movement_date) [btree]
> INDEX `idx_inv_movement_inventory_item` (tenant_id, inventory_item_id, movement_date) [btree]
> INDEX `idx_inv_movement_variant` (tenant_id, variant_id, movement_date) [btree]
> INDEX `idx_inv_movement_tenant` (tenant_id) [btree]
> INDEX `idx_inv_movement_tx` (tenant_id, transaction_id) [btree]
> INDEX `idx_inv_movement_warehouse_inventory_item` (tenant_id, warehouse_id, inventory_item_id) [btree]
> INDEX `idx_inventory_movement_batch_balance` (tenant_id, warehouse_id, variant_id, batch_no) [btree]
> INDEX `idx_inventory_movement_batch_balance_item` (tenant_id, warehouse_id, inventory_item_id, batch_no) [btree]

> CHECK `chk_inventory_movement_qty_logic`: [object Object]
> CHECK `chk_inventory_movement_type`: [object Object]
