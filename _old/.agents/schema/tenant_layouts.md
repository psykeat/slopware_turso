# Table: `tenant_layouts`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| layout_id         | layout_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| user_id           | user_id           | text                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| layout_key        | layout_key        | text                     | —     | NOT NULL                   |             |
| layout_definition | layout_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `uq_layouts_global` (entity_name, layout_key) [btree]
> INDEX `uq_layouts_org` (organization_id, entity_name, layout_key) [btree]
> INDEX `uq_layouts_tenant` (tenant_id, entity_name, layout_key) [btree]
> INDEX `uq_layouts_user` (tenant_id, user_id, entity_name, layout_key) [btree]
