# Table: `article_category`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| article_category_id | article_category_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| article_id          | article_id          | uuid                     | —     | NOT NULL                   |             |
| category_id         | category_id         | uuid                     | —     | NOT NULL                   |             |
| sort_order          | sort_order          | integer                  | —     | NOT NULL                   |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_category_tenant_article` (tenant_id, article_id) [btree]
> INDEX `idx_article_category_tenant_category` (tenant_id, category_id) [btree]
