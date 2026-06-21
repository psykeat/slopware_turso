# Table: `metadata_history`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| history_id    | history_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     |                            |             |
| user_id       | user_id       | text                     | —     |                            |             |
| entity_name   | entity_name   | text                     | —     | NOT NULL                   |             |
| metadata_type | metadata_type | text                     | —     | NOT NULL                   |             |
| metadata_key  | metadata_key  | text                     | —     | NOT NULL                   |             |
| old_value     | old_value     | jsonb                    | —     |                            |             |
| new_value     | new_value     | jsonb                    | —     |                            |             |
| change_type   | change_type   | text                     | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_metadata_history_entity` (entity_name) [btree]
> INDEX `idx_metadata_history_tenant` (tenant_id) [btree]
