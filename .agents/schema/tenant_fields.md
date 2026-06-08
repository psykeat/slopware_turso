# Table: `tenant_fields`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| field_id          | field_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| field_name        | field_name        | text                     | —     | NOT NULL                   |             |
| field_type        | field_type        | text                     | —     | NOT NULL                   |             |
| is_required       | is_required       | boolean                  | —     | NOT NULL                   |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| label             | label             | jsonb                    | —     |                            |             |
| help_text         | help_text         | jsonb                    | —     |                            |             |
| is_visible        | is_visible        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| display_order     | display_order     | integer                  | —     |                            |             |
| import_column     | import_column     | text                     | —     |                            |             |
| import_type       | import_type       | text                     | —     |                            |             |
| import_required   | import_required   | boolean                  | —     | NOT NULL                   |             |
| import_transform  | import_transform  | text                     | —     |                            |             |
| group_id          | group_id          | text                     | —     |                            |             |
| lookup_table      | lookup_table      | text                     | —     |                            |             |
| lookup_filter     | lookup_filter     | jsonb                    | —     |                            |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |

> INDEX `uq_fields_global` (entity_name, field_name) [btree]
> INDEX `uq_fields_org` (organization_id, entity_name, field_name) [btree]
> INDEX `uq_fields_tenant` (tenant_id, entity_name, field_name) [btree]
