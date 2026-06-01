# Table: `import_batch`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| batch_id            | batch_id            | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| connector_id        | connector_id        | uuid                     | —     |                            |             |
| profile_id          | profile_id          | uuid                     | —     |                            |             |
| mapping_version_id  | mapping_version_id  | uuid                     | —     |                            |             |
| atomicity_mode      | atomicity_mode      | text                     | —     | NOT NULL                   |             |
| status              | status              | text                     | —     | NOT NULL, DEFAULT pending  |             |
| is_rerun            | is_rerun            | boolean                  | —     | NOT NULL                   |             |
| source_batch_id     | source_batch_id     | uuid                     | —     |                            |             |
| posted_entity_count | posted_entity_count | integer                  | —     | NOT NULL                   |             |
| error_summary       | error_summary       | jsonb                    | —     |                            |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| processed_at        | processed_at        | timestamp with time zone | —     |                            |             |
| target_entity       | target_entity       | text                     | —     |                            |             |
| target_command_key  | target_command_key  | text                     | —     |                            |             |

> CHECK `import_batch_atomicity_mode_check`: [object Object]
> CHECK `import_batch_status_check`: [object Object]
