# Table: `tenant`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tenant_id       | tenant_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| organization_id | organization_id | uuid                     | —     | NOT NULL                   |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_base         | is_base         | boolean                  | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tenant_organization` (organization_id) [btree]
> INDEX `tenant_slug_key` (slug) [btree]
> INDEX `uq_single_base_tenant` (is_base) [btree]
