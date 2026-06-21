# Table: `document_line_allocation`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| allocation_id           | allocation_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| source_document_line_id | source_document_line_id | uuid                     | —     | NOT NULL                   |             |
| target_document_line_id | target_document_line_id | uuid                     | —     | NOT NULL                   |             |
| allocated_qty           | allocated_qty           | numeric                  | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_dla_source` (tenant_id, source_document_line_id) [btree]
> INDEX `idx_dla_target` (tenant_id, target_document_line_id) [btree]
