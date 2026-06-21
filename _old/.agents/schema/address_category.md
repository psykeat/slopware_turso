# Table: `address_category`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| category_id       | category_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| tax_class_id      | tax_class_id      | uuid                     | —     |                            |             |
| payment_term_id   | payment_term_id   | uuid                     | —     |                            |             |
| currency_id       | currency_id       | char(3)                  | —     |                            |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_address_category_tenant` (tenant_id) [btree]
