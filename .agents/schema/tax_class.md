# Table: `tax_class`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tax_class_id      | tax_class_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| code              | code              | text                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_tax_class_tenant` (tenant_id) [btree]
