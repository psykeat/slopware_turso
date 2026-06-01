# Table: `article_group`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_group_id     | article_group_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| code                 | code                 | text                     | —     | NOT NULL                   |             |
| name                 | name                 | text                     | —     | NOT NULL                   |             |
| tax_class_id         | tax_class_id         | uuid                     | —     |                            |             |
| base_unit_id         | base_unit_id         | uuid                     | —     |                            |             |
| sales_unit_id        | sales_unit_id        | uuid                     | —     |                            |             |
| purchase_unit_id     | purchase_unit_id     | uuid                     | —     |                            |             |
| tracking_mode        | tracking_mode        | text                     | —     |                            |             |
| bom_type             | bom_type             | text                     | —     | NOT NULL, DEFAULT none     |             |
| print_position_texts | print_position_texts | boolean                  | —     |                            |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_group_tenant` (tenant_id) [btree]
