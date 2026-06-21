# Table: `payment_term`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| payment_term_id     | payment_term_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| name                | name                | jsonb                    | —     | NOT NULL                   |             |
| net_days            | net_days            | integer                  | —     | NOT NULL                   |             |
| discount_days       | discount_days       | integer                  | —     |                            |             |
| discount_percentage | discount_percentage | numeric                  | —     |                            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes   | custom_attributes   | jsonb                    | —     |                            |             |

> INDEX `idx_payment_term_tenant` (tenant_id) [btree]
