# Table: `article_variant_template`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| template_id      | template_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| slug             | slug             | text                     | —     | NOT NULL                   |             |
| label            | label            | text                     | —     | NOT NULL                   |             |
| article_group_id | article_group_id | uuid                     | —     |                            |             |
| definition       | definition       | jsonb                    | —     | NOT NULL                   |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at       | updated_at       | timestamp with time zone | —     |                            |             |

> INDEX `idx_article_variant_template_tenant` (tenant_id) [btree]
