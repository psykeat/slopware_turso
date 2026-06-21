# Table: `discount_group`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| discount_group_id | discount_group_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | text                     | —     | NOT NULL                   |             |
| percentage        | percentage        | numeric                  | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_discount_group_tenant` (tenant_id) [btree]
