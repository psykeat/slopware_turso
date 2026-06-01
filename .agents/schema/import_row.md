# Table: `import_row`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| row_id        | row_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| batch_id      | batch_id      | uuid                     | —     | NOT NULL                   |             |
| target_entity | target_entity | text                     | —     | NOT NULL                   |             |
| payload       | payload       | jsonb                    | —     | NOT NULL                   |             |
| status        | status        | text                     | —     | NOT NULL, DEFAULT pending  |             |
| error_detail  | error_detail  | jsonb                    | —     |                            |             |
| posted_at     | posted_at     | timestamp with time zone | —     |                            |             |

> CHECK `import_row_status_check`: [object Object]
