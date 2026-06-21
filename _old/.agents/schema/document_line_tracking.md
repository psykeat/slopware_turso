# Table: `document_line_tracking`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tracking_id      | tracking_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| document_line_id | document_line_id | uuid                     | —     | NOT NULL                   |             |
| serial_number_id | serial_number_id | uuid                     | —     |                            |             |
| serial_no        | serial_no        | text                     | —     |                            |             |
| batch_no         | batch_no         | text                     | —     |                            |             |
| qty              | qty              | numeric                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_document_line_tracking_tenant_line` (tenant_id, document_line_id) [btree]
> INDEX `idx_document_line_tracking_tenant_created` (tenant_id, document_line_id, created_at) [btree]

> CHECK `document_line_tracking_check`: [object Object]
