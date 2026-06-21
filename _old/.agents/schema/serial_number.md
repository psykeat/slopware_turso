# Table: `serial_number`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| serial_number_id     | serial_number_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| article_id           | article_id           | uuid                     | —     | NOT NULL                   |             |
| serial_no            | serial_no            | text                     | —     | NOT NULL                   |             |
| status               | status               | text                     | —     | NOT NULL, DEFAULT in_stock |             |
| created_movement_id  | created_movement_id  | uuid                     | —     |                            |             |
| consumed_movement_id | consumed_movement_id | uuid                     | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `serial_number_status_check`: [object Object]
