# Table: `article_option`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| option_id | option_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| article_id | article_id | uuid | — | NOT NULL |  |
| name | name | text | — | NOT NULL |  |
| sort_order | sort_order | integer | — | NOT NULL |  |

> INDEX `idx_article_option_tenant` (tenant_id) [btree]
> INDEX `idx_article_option_article` (article_id) [btree]

